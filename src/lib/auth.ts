import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { nextCookies } from "better-auth/next-js";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const adminEmails = [
            "pallabcode@gmail.com",
            "atharvdange.dev@gmail.com",
            "mandalpritam8617@gmail.com",
            "shyamendrahazracodes@gmail.com"
          ];
          return {
            data: {
              ...user,
              role: adminEmails.includes(user.email.toLowerCase()) ? "admin" : "user",
            },
          };
        },
      },
    },
  },
  advanced: {
    trustedProxyHeaders: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM || "SpaceBuilder <no-reply@luqe.in>",
            to: email,
            subject: "Sign in to SpaceBuilder Dashboard",
            html: `
              <div style="font-family: sans-serif; padding: 32px 24px; max-width: 500px; margin: 40px auto; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);">
                <div style="margin-bottom: 24px; text-align: center;">
                  <span style="font-size: 24px; font-weight: 700; letter-spacing: -0.05em; color: #09090b;">SpaceBuilder</span>
                </div>
                <h2 style="font-size: 18px; font-weight: 600; color: #09090b; margin-bottom: 12px; text-align: center;">Verify Your Email</h2>
                <p style="font-size: 14px; color: #71717a; line-height: 20px; margin-bottom: 24px; text-align: center;">
                  Click the button below to sign in to SpaceBuilder Dashboard. This link is valid for 1 hour.
                </p>
                <div style="text-align: center; margin-bottom: 24px;">
                  <a href="${url}" style="display: inline-block; background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 32px; font-size: 14px; font-weight: 500; border-radius: 8px; transition: background-color 0.2s;">
                    Sign In
                  </a>
                </div>
                <p style="font-size: 12px; color: #a1a1aa; line-height: 16px; text-align: center; margin-top: 32px; border-top: 1px solid #f4f4f5; padding-top: 16px;">
                  If you did not request this link, you can safely ignore this email.
                </p>
              </div>
            `,
          });
          console.log(`Successfully sent magic link email to ${email}`);
        } catch (error) {
          console.error(`Failed to send magic link to ${email}:`, error);
        }
      },
    }),
    nextCookies(),
  ],
});
