import { Handler } from '@netlify/functions';

const clientId = process.env.VITE_PINTEREST_CLIENT_ID;
const redirectUri = process.env.URL 
  ? `https://${process.env.URL}/callback`
  : 'https://candid-eclair-ada822.netlify.app/callback';

// Using sandbox URL
const PINTEREST_API_URL = 'https://api-sandbox.pinterest.com/v5';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const path = event.queryStringParameters?.path;

  try {
    switch (path) {
      case '/oauth/url': {
        const scope = 'boards:read,pins:read,pins:write,user_accounts:read,boards:write';
        const authUrl = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=sandbox`;
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ url: authUrl }) 
        };
      }

      case '/token': {
        const { code, refresh_token } = event.queryStringParameters || {};
        
        if (!code && !refresh_token) {
          return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Code or refresh token required' }) 
          };
        }

        const tokenResponse = await fetch(`${PINTEREST_API_URL}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: refresh_token ? 'refresh_token' : 'authorization_code',
            client_id: clientId!,
            ...(code ? { code, redirect_uri: redirectUri } : { refresh_token }),
          }),
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok) {
          throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
        }

        if (code) {
          const userResponse = await fetch(`${PINTEREST_API_URL}/user_account`, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
          });

          const userData = await userResponse.json();
          
          if (!userResponse.ok) {
            throw new Error(userData.message || 'Failed to fetch user data');
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: tokenData, user: userData }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ token: tokenData }),
        };
      }

      default:
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Not found' }) 
        };
    }
  } catch (error) {
    console.error('Pinterest API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};
