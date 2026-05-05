export async function sendPushNotifications(tokens: string[], title: string, message: string) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: title,
    body: message,
  }));

  return fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
}
