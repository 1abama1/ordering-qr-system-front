export function redactSensitiveUrl(message: string) {
  return message.replace(
    /([?&](?:token|tableToken)=)[^&\s"']+/gi,
    '$1[redacted]',
  );
}
