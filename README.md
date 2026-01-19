# Code for Lambda function providing Cognito tokens
## Triggered by API Gateway
API Gateway should have appropriate route with attached integration
## POST HTTP Method
### JSON Structure
{ <br>
    "username": < string >,<br>
    "password": < string >, <br>
    "new_password": < string > <br>
} <br>
### Response body JSON structure
#### Normal flow with statusCode 200
{<br>
    "access_token": < string with access token >,<br>
    "id_token": < string with id token >, <br>
    "refresh_token": < string with refresh token > <br>
}
#### Alternative flow with status 400 (clent error)
{<br>
    "error": < string with error message ><br>
}
#### Alternative flow with status 500 (cserver error)
the same body structure as for client error, only with ststus code 500
## Environment Variables
- LOGGER_LEVEL
- CLIENT_ID
## Test using Postman
### For testing purposes to create several users
