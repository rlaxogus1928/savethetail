import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// RESEND_FROM: 인증된 도메인 주소 (없으면 Resend 기본 발신자 사용)
const FROM =
  process.env.RESEND_FROM ?? "onboarding@resend.dev";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://savethetail.com";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:20px;">
              <span style="font-size:18px;font-weight:700;color:#1a2744;">🐾 SaveTheTail</span>
            </td>
          </tr>
          <tr>
            <td style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08);">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:12px;color:#aaa;">
              SaveTheTail · 안전한 파양 플랫폼<br/>
              이 메일은 발신 전용입니다. 문의는 savethetail.com을 이용해 주세요.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}"
    style="display:inline-block;margin-top:24px;background:#1a2744;color:#fff;
           padding:14px 28px;border-radius:10px;text-decoration:none;
           font-size:14px;font-weight:600;letter-spacing:-.01em;">
    ${label}
  </a>`;
}

/** 1. 입양 신청 완료 → 파양자에게 */
export async function sendApplicationReceivedEmail(params: {
  to: string;
  ownerName: string;
  applicantName: string;
  animalName: string;
  message?: string;
}): Promise<void> {
  const { to, ownerName, applicantName, animalName, message } = params;

  const body = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a2744;">입양 신청이 도착했어요!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      안녕하세요, <strong>${ownerName}</strong>님.<br/>
      <strong>${applicantName}</strong>님이 <strong>${animalName}</strong>에 입양 신청을 보냈습니다.
    </p>
    ${
      message
        ? `<div style="background:#f8f8fc;border-left:3px solid #1a2744;border-radius:4px;padding:14px 16px;margin-bottom:4px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.04em;">신청 메시지</p>
            <p style="margin:0;font-size:14px;color:#222;line-height:1.65;">${message}</p>
          </div>`
        : ""
    }
    <p style="margin:16px 0 0;font-size:13px;color:#777;">
      대시보드에서 신청 내용을 확인하고 수락 또는 거절할 수 있습니다.
    </p>
    ${ctaButton(`${APP_URL}/dashboard`, "대시보드에서 확인하기")}
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[SaveTheTail] ${applicantName}님이 입양을 신청했어요!`,
    html: body,
  });
}

/** 2. 입양 수락 → 입양 희망자에게 */
export async function sendApplicationAcceptedEmail(params: {
  to: string;
  applicantName: string;
  animalName: string;
  applicationId: string;
}): Promise<void> {
  const { to, applicantName, animalName, applicationId } = params;

  const body = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a2744;">입양 신청이 수락됐어요! 🎉</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      안녕하세요, <strong>${applicantName}</strong>님.<br/>
      <strong>${animalName}</strong>에 대한 입양 신청이 <strong>수락</strong>되었습니다.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.65;">
        파양자가 연락을 드릴 예정입니다. 채팅방에 입장하여 다음 절차를 진행해 주세요.
      </p>
    </div>
    ${ctaButton(`${APP_URL}/chat/${applicationId}`, "채팅방 입장하기")}
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: "[SaveTheTail] 입양 신청이 수락됐어요!",
    html: body,
  });
}

/** 3. 입양 거절 → 입양 희망자에게 */
export async function sendApplicationRejectedEmail(params: {
  to: string;
  applicantName: string;
  animalName: string;
}): Promise<void> {
  const { to, applicantName, animalName } = params;

  const body = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a2744;">입양 신청 결과 안내</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      안녕하세요, <strong>${applicantName}</strong>님.<br/>
      <strong>${animalName}</strong>에 대한 입양 신청을 검토한 결과,
      아쉽게도 이번에는 다른 분과 진행하게 되었습니다.
    </p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      소중한 관심을 가져주셔서 진심으로 감사드립니다.<br/>
      더 좋은 인연을 만나실 수 있도록 응원합니다. 🐾
    </p>
    ${ctaButton(`${APP_URL}/`, "다른 아이들 보러가기")}
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: "[SaveTheTail] 입양 신청 결과 안내",
    html: body,
  });
}
