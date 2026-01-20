import {
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import pino from "pino";

const logger = pino({
  level: process.env.LOGGER_LEVEL || "info",
  base: undefined,
  timestamp: false,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
});

export async function handler(event) {
  logger.debug(`received body is ${event.body}`);
  let result;
  try {
    const clientId = getClientId();

    if (!event.body) {
      return response(400, "Missing body");
    }

    const data = JSON.parse(event.body); //in the case of parsing error error.name=="Syntax Error"
    const { username, password } = getUsernamePassword(data);

    logger.debug({ username }, "auth request received");

    const client = new CognitoIdentityProviderClient({});
    const resp = await initialAuthentication(
      clientId,
      client,
      username,
      password,
    );

    if (resp.AuthenticationResult) {
      logger.debug({ username }, "authenticated without challenge");
      result = responseTokens(resp.AuthenticationResult);
    } else {
      logger.debug(
        { username, challenge: resp.ChallengeName },
        "challenge returned",
      );
      const newPassword = getNewPassword(data);
      const resp2 = await respondAuthentication(
        clientId,
        resp,
        client,
        username,
        newPassword,
      );
      result =  responseTokens(resp2.AuthenticationResult);
    }
  } catch (error) {
    result = responseError(error);
  }
  return result;
}

function getClientId() {
  const clientId = process.env.CLIENT_ID;
  if (!clientId) throw new Error("missing client id");
  return clientId;
}

function getUsernamePassword(data) {
  const username = data?.username || "";
  const password = data?.password || "";
  return { username, password };
}

async function initialAuthentication(clientId, client, username, password) {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  return client.send(command);
}

function responseTokens(authenticationResult) {
  const bodyObj = {
    access_token: authenticationResult.AccessToken,
    id_token: authenticationResult.IdToken,
    refresh_token: authenticationResult.RefreshToken,
  };
  return response(200, bodyObj);
}

function getNewPassword(data) {
  return data?.new_password || "";
}

async function respondAuthentication(
  clientId,
  resp,
  client,
  username,
  newPassword,
) {
  if (resp?.ChallengeName !== "NEW_PASSWORD_REQUIRED") {
    throw new Error(`Unknown Challenge Name ${resp?.ChallengeName}`);
  }

  const command = new RespondToAuthChallengeCommand({
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    ClientId: clientId,
    Session: resp.Session,
    ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
  });

  return client.send(command);
}

function responseError(error) {
  const statusCode =
    error?.$fault === "client" || error.name === "SyntaxError" ? 400 : 500;
  const message = error.message ?? "Unknown error";

  logger.error({ err: error }, "handler error");
  return response(statusCode, message);
}

function response(code, body) {
  return {
    statusCode: code,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}
