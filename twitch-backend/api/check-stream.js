// api/check-stream.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { clientId, streamerUsername } = req.query;

    if (!clientId || !streamerUsername) {
      return res.status(400).json({
        error: "Missing clientId or streamerUsername parameters",
        isLive: false,
      });
    }

    console.log(`Checking stream status for: ${streamerUsername}`);

    // Step 1: Get OAuth token
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `client_id=${clientId}&client_secret=&grant_type=client_credentials`,
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Get user ID
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${streamerUsername}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`User lookup failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();

    if (userData.data.length === 0) {
      return res.status(404).json({
        error: "Streamer not found",
        isLive: false,
        streamer: streamerUsername,
      });
    }

    const userId = userData.data[0].id;
    const displayName = userData.data[0].display_name;

    // Step 3: Check if streaming
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${userId}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!streamResponse.ok) {
      throw new Error(`Stream check failed: ${streamResponse.status}`);
    }

    const streamData = await streamResponse.json();
    const isLive = streamData.data.length > 0;

    let streamInfo = null;
    if (isLive) {
      const stream = streamData.data[0];
      streamInfo = {
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
        startedAt: stream.started_at,
      };
    }

    // Return the result
    return res.status(200).json({
      success: true,
      isLive,
      streamer: displayName,
      streamInfo,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking stream:", error);

    return res.status(500).json({
      error: error.message,
      isLive: false,
    });
  }
}
