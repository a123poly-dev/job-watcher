import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Job Watcher <onboarding@resend.dev>';

const openers = [
  "Oh my goodness, I have news for you!",
  "Hey hey hey — something just popped up and I NEED you to see this!",
  "Stop what you're doing for one second because THIS is exciting!",
  "I've been keeping an eye out for you and look what I found!",
  "Okay, I'm not saying this is THE one… but it might be THE one.",
  "You are so talented and the universe clearly agrees — look at this!",
  "I don't want to get your hopes up… actually yes I do, because this is great!",
  "I've been rooting for you every single day, and today I have something to show for it!",
];

const closers = [
  "You've got everything it takes. Go show them what you're made of. 💪",
  "Apply with confidence — you're exactly the kind of person they're looking for. ✨",
  "I believe in you more than words can say. This could be your moment. 🌟",
  "Take a breath, trust yourself, and go get it. You deserve this. 🎉",
  "This is your sign. Apply. You are brilliant and the right people will see it. 💫",
  "Don't let this one pass you by — you are so ready for this. Go! 🚀",
  "Every application is a step forward. This one feels like the right step. You've got this! ❤️",
  "I'm cheering you on from here. The best employee they've never met is about to introduce themselves. 🙌",
];

function randomFrom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function sendJobAlert({
  toEmail,
  siteName,
  listingTitle,
  listingUrl,
}: {
  toEmail: string;
  siteName: string;
  listingTitle: string;
  listingUrl: string;
}) {
  const opener = randomFrom(openers);
  const closer = randomFrom(closers);

  const subject = `🎉 "${listingTitle}" just dropped at ${siteName} — go get it!`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 16px;">${opener}</p>
      <p style="font-size: 16px;">I found something that might be perfect for you — <strong>${listingTitle}</strong> just went live on <strong>${siteName}</strong>'s careers page.</p>
      <p style="margin: 24px 0;">
        <a href="${listingUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Apply here →</a>
      </p>
      <p style="font-size: 16px;">${closer}</p>
    </div>
  `;

  const text = `${opener}\n\nI found something that might be perfect for you — "${listingTitle}" just went live on ${siteName}'s careers page.\n\nApply here: ${listingUrl}\n\n${closer}`;

  await resend.emails.send({ from: FROM, to: toEmail, subject, text, html });
}

export async function sendTestEmail(toEmail: string) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: '✅ Job Watcher — test email',
    text: 'Your email notifications are working correctly!',
    html: '<p>Your Job Watcher email notifications are working correctly! 🎉</p>',
  });
}
