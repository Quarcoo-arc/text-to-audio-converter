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
  return text
    .replace(/\s+/g, " ") // Collapse multiple spaces and line breaks into single spaces
    .replace(/[^\x20-\x7E]/g, "") // Strips out unreadable control characters/broken symbols
    .trim();
}

export const handler = async (event: S3Event): Promise<void> => {
  // Extract the S3 object key from the event
  const s3ObjectKey = event.Records[0].s3.object.key;

  // Extract userSub and conversionId from the S3 object key
  const keyParts = s3ObjectKey.split("/");
  const userSub = keyParts[1];
  const conversionId = keyParts[2];
  const fileName = keyParts[3];

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

    // Convert text to audio file
    const pollyCommand = new polly.SynthesizeSpeechCommand({
      OutputFormat: "mp3",
      Text: cleanedText,
      VoiceId: "Joanna",
    });

    const pollyResponse = await pollyClient.send(pollyCommand);

    const audioFileName = fileName.replace(
      `.${fileName.split(".").at(-1)}`,
      ".mp3",
    );

    // Upload audio file to S3
    const s3command = new s3.PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `audio/${userSub}/${conversionId}/${audioFileName}`,
      ContentType: pollyResponse.ContentType,
      Body: pollyResponse.AudioStream,
    });

    await s3Client.send(s3command);

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
        ":audioKey": `audio/${userSub}/${conversionId}/${audioFileName}`,
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
