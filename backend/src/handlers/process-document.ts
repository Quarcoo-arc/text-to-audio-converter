import { S3Event } from "aws-lambda";
import * as s3 from "@aws-sdk/client-s3";
import * as dynamodb from "@aws-sdk/client-dynamodb";
import * as polly from "@aws-sdk/client-polly";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { extractText, getDocumentProxy } from "unpdf";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import { ConversionStatus } from "../../config/constants";

const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

const s3Client = new s3.S3Client({});
const dynamoDbClient = new dynamodb.DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDbClient);
const pollyClient = new polly.PollyClient({});

async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function cleanText(text: string) {
  if (!text) return "";

  return (
    text
      // Replace Windows-style line breaks and carriage returns with standard newlines
      .replace(/\r\n|\r/g, "\n")
      // Turn multi-line gaps into double-newlines
      .replace(/\n{2,}/g, "\n\n")
      // Collapse multiple horizontal spaces/tabs into a single space, preserving single newlines
      .replace(/[ \t]+/g, " ")
      // Remove hidden control characters, preserving tabs (\t), newlines (\n),
      // and unicode characters like accented letters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Clean up loose spaces at the start/end of lines
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim()
  );
}

export const handler = async (event: S3Event): Promise<void> => {
  // Extract the S3 object key from the event
  const s3ObjectKey = event.Records[0].s3.object.key;

  // Extract userSub and conversionId from the S3 object key
  const keyParts = s3ObjectKey.split("/");
  const userSub = keyParts[1];
  const conversionId = keyParts[2];

  try {
    // Mark entry as PROCESSING in dynamodb
    const dynamodbCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${conversionId}`,
      },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": ConversionStatus.PROCESSING,
        ":updatedAt": new Date().toISOString(),
      },
    });

    await dynamoDocClient.send(dynamodbCommand);
  } catch (error) {
    console.error("Failed to set item status to PROCESSING: ", error);
  }

  try {
    // Fetch the document from S3
    const getObjectCommand = new s3.GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3ObjectKey,
    });
    const s3Response = await s3Client.send(getObjectCommand);

    const documentBuffer = await streamToBuffer(s3Response.Body);

    // Extract text from document
    let extractedText: string;

    switch (s3Response.ContentType) {
      case "application/pdf":
        const pdf = await getDocumentProxy(documentBuffer);
        const { text } = await extractText(pdf, { mergePages: true });
        extractedText = text;
        break;

      case "application/msword":
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(documentBuffer);
        extractedText = extracted.getBody();
        break;

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        const docxResult = await mammoth.extractRawText({
          buffer: documentBuffer,
        });
        extractedText = docxResult.value;
        break;

      case "text/plain":
        extractedText = documentBuffer.toString("utf-8");
        break;

      default:
        throw new Error(`Unsupported content type: ${s3Response.ContentType}`);
    }

    const cleanedText = await cleanText(extractedText);

    const audioS3KeyPrefix = `audio/${userSub}/${conversionId}`;
    const outputFormat = "mp3";

    // Convert text to audio file
    const pollyCommand = new polly.StartSpeechSynthesisTaskCommand({
      OutputFormat: outputFormat,
      Text: cleanedText,
      VoiceId: "Joanna",
      OutputS3BucketName: BUCKET_NAME,
      OutputS3KeyPrefix: audioS3KeyPrefix,
    });

    const pollyResponse = await pollyClient.send(pollyCommand);

    const taskId = pollyResponse.SynthesisTask?.TaskId;

    if (!taskId) {
      throw new Error("Task ID should not be null");
    }

    const audioKey = `${audioS3KeyPrefix}.${taskId}.${outputFormat}`;

    // Update DynamoDB record with the audio file URL and status
    const dynamodbCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${conversionId}`,
      },
      UpdateExpression:
        "SET #status = :status, #audioKey = :audioKey, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#audioKey": "audioKey",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": ConversionStatus.COMPLETED,
        ":audioKey": audioKey,
        ":updatedAt": new Date().toISOString(),
      },
    });

    await dynamoDocClient.send(dynamodbCommand);
  } catch (error) {
    console.error("Error processing document: ", error);
    // Mark item as FAILED in dynamodb
    const dynamodbCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${conversionId}`,
      },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": ConversionStatus.FAILED,
        ":updatedAt": new Date().toISOString(),
      },
    });

    await dynamoDocClient.send(dynamodbCommand);
  }
};
