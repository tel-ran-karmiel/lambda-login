import logger from "logger.js"
import { InitiateAuthCommand, RespondToAuthChallengeCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";


export async function handler(event) {
   
    logger.debug(`received body is ${event.body}` )
    
    let response;
    try {
        
        const clientId = getClientId();
        const data = JSON.parse(event.body)
        const { username, password } =  getUsernamePassword(data);
        logger.debug(`received username is ${username}, password is ${password}`)
        const client = new CognitoIdentityProviderClient({});
        const resp = await initialAuthentication(clientId, client, username, password);
        if (resp.AuthenticationResult) {
            logger.debug(`user ${username} already confirmed - no need new password`)
            
            response =  responseTokens(resp.AuthenticationResult);
        }
        else {
            logger.debug(`user ${username} required new password`)
            const newPassword =  getNewPassword(data);
            const resp2 = await respondAuthentication(clientId, resp, client, username, newPassword);
            response =  responseTokens(resp2.AuthenticationResult);
        }
    }
    catch (error) {
        response = responseError(error) 
    }
    return response
}

function getClientId() {
    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
        throw Error("missing client id")
    }
    return clientId 
}
 function getUsernamePassword(data) {
    const { username, password } = data
    return { username, password };
}

async function initialAuthentication(clientId, client, username, password) {
    const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        }
    });
    return client.send(command);
}
function responseTokens(authenticationResult) {
   
    const bodyObj = {
        access_token: authenticationResult.AccessToken,
        id_token: authenticationResult.IdToken,
        refresh_token: authenticationResult.RefreshToken
    }
    return response(200, JSON.stringify(bodyObj))
}
 function getNewPassword(data) {
    return data.new_password
}
async function respondAuthentication(clientId, resp, client, username, newPassword) {
    if (resp.ChallengeName != "NEW_PASSWORD_REQUIRED") {
        throw Error(`Unknow Challenge Name ${resp.ChallengeName}`);
    }
    const command = new RespondToAuthChallengeCommand({
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        ClientId: clientId,
        Session: resp.Session,
        ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: newPassword
        }
    });
    return client.send(command);
}
function responseError(error) {
    const statusCode = error.$Fault === "client" ? 400 : 500;
    body = error.message
    return response(statusCode, body)
}
function response(code, body) {
  return {
    statusCode: code,
    body: body,
  };
}
