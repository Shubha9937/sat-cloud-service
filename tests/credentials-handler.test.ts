import { mockClient } from "aws-sdk-client-mock";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { handler } from "../src/handlers/credentials-handler";

const secretsMock = mockClient(SecretsManagerClient);

describe("credentials-handler Lambda", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        secretsMock.reset();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("should return 401 if EXPECTED_TOKEN is set but header is missing", async () => {
        process.env.EXPECTED_TOKEN = "secret-token";
        process.env.SECRET_ID = "my-secret";

        const res = await handler({ headers: {} });
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toEqual({ error: "Missing or invalid Authorization header" });
    });

    it("should return 403 if EXPECTED_TOKEN is set but header token is invalid", async () => {
        process.env.EXPECTED_TOKEN = "secret-token";
        process.env.SECRET_ID = "my-secret";

        const res = await handler({ headers: { authorization: "Bearer wrong-token" } });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toEqual({ error: "Unauthorized access token" });
    });

    it("should return 500 if SECRET_ID is missing", async () => {
        delete process.env.SECRET_ID;
        delete process.env.EXPECTED_TOKEN;

        const res = await handler({ headers: {} });
        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body)).toEqual({ error: "Server configuration error: SECRET_ID missing" });
    });

    it("should return 200 with credentials on valid secret and token", async () => {
        process.env.EXPECTED_TOKEN = "valid-token";
        process.env.SECRET_ID = "saturam-bedrock-credentials";

        secretsMock.on(GetSecretValueCommand).resolves({
            SecretString: JSON.stringify({
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                sessionToken: "session-token-abc",
                region: "us-east-1",
            }),
        });

        const res = await handler({
            headers: { authorization: "Bearer valid-token" },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE");
        expect(body.secretAccessKey).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
        expect(body.sessionToken).toBe("session-token-abc");
        expect(body.region).toBe("us-east-1");
    });
});
