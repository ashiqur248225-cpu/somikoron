'use server';

/**
 * Server Action to communicate with Alpha Net BD SMS API.
 */

export async function sendSMS(apiKey: string, senderId: string | null | undefined, to: string, msg: string) {
  if (!apiKey) return { error: 1, msg: "API Key is required" };
  
  try {
    // Standardizing the number format (removing spaces, ensuring 880 prefix or standard 01X)
    const cleanTo = to.replace(/\s+/g, '');
    
    // Construct base URL
    let url = `https://api.sms.net.bd/sendsms?api_key=${apiKey}&msg=${encodeURIComponent(msg)}&to=${cleanTo}`;
    
    // EXPLAINED LOGIC: Only add sender_id parameter if it is provided and has content.
    // If you don't have a sender_id, this block is skipped, making it work with the default gateway.
    const trimmedSenderId = senderId?.trim();
    if (trimmedSenderId && trimmedSenderId.length > 0) {
      url += `&sender_id=${trimmedSenderId}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('SMS API Error:', error);
    return { error: 1, msg: error.message || "Failed to connect to SMS Gateway" };
  }
}

export async function getSMSBalance(apiKey: string) {
  if (!apiKey) return { error: 1, msg: "API Key is required" };
  try {
    const response = await fetch(`https://api.sms.net.bd/user/balance/?api_key=${apiKey}`, {
      method: 'GET',
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Balance API Error:', error);
    return { error: 1, msg: error.message || "Failed to fetch balance" };
  }
}
