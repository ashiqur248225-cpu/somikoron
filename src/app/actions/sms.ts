'use server';

/**
 * Server Action to communicate with Alpha Net BD SMS API.
 */

export async function sendSMS(apiKey: string, senderId: string, to: string, msg: string) {
  if (!apiKey) return { error: 1, msg: "API Key is required" };
  
  try {
    // Standardizing the number format (removing spaces, ensuring 880 prefix or standard 01X)
    const cleanTo = to.replace(/\s+/g, '');
    
    const response = await fetch(`https://api.sms.net.bd/sendsms?api_key=${apiKey}&msg=${encodeURIComponent(msg)}&to=${cleanTo}${senderId ? `&sender_id=${senderId}` : ''}`, {
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
