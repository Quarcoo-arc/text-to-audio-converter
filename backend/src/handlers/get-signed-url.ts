import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const fileName = body.fileName || `doc_${Date.now()}.pdf`;
    const contentType = body.contentType || "application/pdf";

    if (!BUCKET_NAME) {
      throw new Error("S3 Bucket name missing from environment variables.");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `uploads/${fileName}`,
      ContentType: contentType,
    });

    // Generate a temporary URL valid for 5 minutes (300 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uploadUrl, fileName }),
    };
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
