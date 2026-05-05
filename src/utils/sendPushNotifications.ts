export async function sendPushNotifications(
  tokens: string[],
  title: string,
  message: string,
  data: {
    type: 'chat' | 'order' | 'reward' | 'announcement';
    id: string | number | undefined | null;
  },
) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: title,
    body: message,
    data: data,
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
