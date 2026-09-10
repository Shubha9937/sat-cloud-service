import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/**
 * AWS Lambda Handler for SAT-CLI Remote Bedrock Access.
 *
 * Architecture Flow:
 * SAT-CLI -> API Gateway (GET /credentials) -> this Lambda -> AWS Secrets Manager -> returns AWS credentials -> SAT-CLI
 *
 * Environment Variables:
 *   SECRET_ID      - Name or ARN of AWS Secrets Manager secret (Required)
 *   EXPECTED_TOKEN - Optional shared secret. When set, requests must send `Authorization: Bearer <token>`
 */

interface ApiGatewayEvent {
    headers?: Record<string, string | undefined> | null;
}

interface ApiGatewayResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}

interface StoredCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    region?: string;
}

const secretsClient = new SecretsManagerClient({});

export const handler = async (event: ApiGatewayEvent): Promise<ApiGatewayResult> => {
    const defaultHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    try {
        // 1. Verify Authorization Token (if EXPECTED_TOKEN env var is set)
        const expectedToken = process.env.EXPECTED_TOKEN;
        if (expectedToken) {
            const authHeader =
                event.headers?.authorization || event.headers?.Authorization;

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return {
                    statusCode: 401,
                    headers: defaultHeaders,
                    body: JSON.stringify({ error: "Missing or invalid Authorization header" }),
                };
            }

            const token = authHeader.substring("Bearer ".length).trim();
            if (token !== expectedToken) {
                return {
                    statusCode: 403,
                    headers: defaultHeaders,
                    body: JSON.stringify({ error: "Unauthorized access token" }),
                };
            }
        }

        // 2. Validate Secret ID configuration
        const secretId = process.env.SECRET_ID;
        if (!secretId) {
            console.error("SECRET_ID environment variable is not configured.");
            return {
                statusCode: 500,
                headers: defaultHeaders,
                body: JSON.stringify({ error: "Server configuration error: SECRET_ID missing" }),
            };
        }

        // 3. Fetch Secret from AWS Secrets Manager
        const response = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: secretId })
        );

        if (!response.SecretString) {
            console.error("SecretString is empty in Secrets Manager response.");
            return {
                statusCode: 500,
                headers: defaultHeaders,
                body: JSON.stringify({ error: "Secret value is empty" }),
            };
        }

        // 4. Parse credentials JSON
        const creds: StoredCredentials = JSON.parse(response.SecretString);

        if (!creds.accessKeyId || !creds.secretAccessKey) {
            console.error("Invalid credentials schema in Secrets Manager.");
            return {
                statusCode: 500,
                headers: defaultHeaders,
                body: JSON.stringify({ error: "Invalid secret schema" }),
            };
        }

        // 5. Return JSON credentials payload to SAT-CLI
        return {
            statusCode: 200,
            headers: defaultHeaders,
            body: JSON.stringify({
                accessKeyId: creds.accessKeyId,
                secretAccessKey: creds.secretAccessKey,
                ...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
                ...(creds.region ? { region: creds.region } : {}),
            }),
        };
    } catch (err: unknown) {
        console.error("Error fetching credentials from Secrets Manager:", err);
        return {
            statusCode: 500,
            headers: defaultHeaders,
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};
