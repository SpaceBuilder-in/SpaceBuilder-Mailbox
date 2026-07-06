export default {
  async email(message, env, ctx) {
    console.log("Email received from:", message.from);
    const recipients = [
      "pallabcode@gmail.com"
    ];
    try {
      // 1. Forward email to all recipients concurrently
      const forwardPromises = recipients.map(recipient => 
        message.forward(recipient)
      );
      const results = await Promise.allSettled(forwardPromises);
      
      results.forEach((result, index) => {
        const recipient = recipients[index];
        if (result.status === "rejected") {
          console.error(`Failed to forward to ${recipient}:`, result.reason);
        } else {
          console.log(`Successfully forwarded to ${recipient}`);
          
          // Telegram Notification
          const textMsg = encodeURIComponent(`The mail successfully forwarded to ${recipient} for checking purpose.`);
          const telegramUrl = `https://api.telegram.org/bot7912010445:AAH8DivQSTW8PrN6N9hNXpDj2WdG5DVXAaI/sendMessage?chat_id=807564728&text=${textMsg}`;
          ctx.waitUntil(
            fetch(telegramUrl).catch(err => console.error("Telegram API Error:", err))
          );
        }
      });
      // 2. Read the raw RFC822 email payload and POST it to Next.js Webhook
      const rawResponse = new Response(message.raw);
      const rawEmailText = await rawResponse.text();
      const webhookUrl = env.WEBHOOK_URL || "https://mail.spacebuilder.in/api/webhook/email";
      const webhookSecret = env.WEBHOOK_SECRET || "cf_webhook_secret_99f3a1e28b7d4c5e";
      ctx.waitUntil(
        fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": webhookSecret,
          },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            recipients: recipients,
            raw: rawEmailText
          })
        })
        .then(async (res) => {
          if (!res.ok) {
            console.error("Webhook failed:", res.status, await res.text());
          } else {
            console.log("Successfully posted email to Next.js webhook");
          }
        })
        .catch(err => console.error("Webhook Delivery Error:", err))
      );
      
    } catch (error) {
      console.error("Worker execution error:", error);
    }
  }
};
