import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { slack, verifySlackSignature } from "@/lib/slack";
import { saveReminder, getReminder, completeReminder } from "@/lib/reminders";
import { getInternProfile, saveInternProfile } from "@/lib/intern-profiles";
import {
  saveSubmission,
  getSubmission,
  markAsPaid,
  savePending,
  getPending,
  deletePending,
} from "@/lib/intern-salaries";
import type { Reminder } from "@/types/reminder";
import type {
  InternProfile,
  InternSalarySubmission,
  InternSalaryPending,
} from "@/types/intern-salary";

type InternSalaryPendingWithPhone = InternSalaryPending & { phone: string };

function formatDateJST(dateStr: string): string {
  return new Date(dateStr + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getCurrentMonthJST(): string {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function getLastDayOfNextMonth(): string {
  const nowParts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  const year = Number(nowParts.find((part) => part.type === "year")?.value);
  const month = Number(nowParts.find((part) => part.type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  const y = lastDay.getUTCFullYear();
  const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lastDay.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthJP(month: string): string {
  const [year, monthNum] = month.split("-");
  return `${year}年${monthNum}月`;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateJP(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year}年${month}月${day}日`;
}

function formatDateTimeJST(date: Date): string {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function buildInternSalaryModal(
  month: string,
  initialValues: {
    name: string;
    phone: string;
    unitPrice: string;
    workingHours: string;
    expenseTransport: string;
    expenseTravel: string;
    expenseAi: string;
    bankInfo: string;
  }
) {
  return {
    type: "modal" as const,
    callback_id: "intern_salary_modal",
    private_metadata: JSON.stringify({ month }),
    title: { type: "plain_text" as const, text: "インターン給与提出" },
    submit: { type: "plain_text" as const, text: "確認へ進む" },
    close: { type: "plain_text" as const, text: "キャンセル" },
    blocks: [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `*対象月*: ${formatMonthJP(month)}`,
        },
      },
      {
        type: "input" as const,
        block_id: "name_block",
        label: { type: "plain_text" as const, text: "氏名" },
        element: {
          type: "plain_text_input" as const,
          action_id: "name_input",
          initial_value: initialValues.name,
        },
      },
      {
        type: "input" as const,
        block_id: "phone_block",
        label: { type: "plain_text" as const, text: "電話番号" },
        element: {
          type: "plain_text_input" as const,
          action_id: "phone_input",
          initial_value: initialValues.phone,
        },
      },
      {
        type: "input" as const,
        block_id: "unit_price_block",
        label: { type: "plain_text" as const, text: "単価 円/時" },
        element: {
          type: "plain_text_input" as const,
          action_id: "unit_price_input",
          initial_value: initialValues.unitPrice,
        },
      },
      {
        type: "input" as const,
        block_id: "working_hours_block",
        label: { type: "plain_text" as const, text: "稼働時間" },
        element: {
          type: "plain_text_input" as const,
          action_id: "working_hours_input",
          initial_value: initialValues.workingHours,
          placeholder: { type: "plain_text" as const, text: "例: 40.5" },
        },
      },
      {
        type: "input" as const,
        block_id: "expense_transport_block",
        label: { type: "plain_text" as const, text: "移動費" },
        element: {
          type: "plain_text_input" as const,
          action_id: "expense_transport_input",
          initial_value: initialValues.expenseTransport,
        },
      },
      {
        type: "input" as const,
        block_id: "expense_travel_block",
        label: { type: "plain_text" as const, text: "交通費" },
        element: {
          type: "plain_text_input" as const,
          action_id: "expense_travel_input",
          initial_value: initialValues.expenseTravel,
        },
      },
      {
        type: "input" as const,
        block_id: "expense_ai_block",
        label: { type: "plain_text" as const, text: "AI利用費" },
        element: {
          type: "plain_text_input" as const,
          action_id: "expense_ai_input",
          initial_value: initialValues.expenseAi,
        },
      },
      {
        type: "input" as const,
        block_id: "bank_info_block",
        label: { type: "plain_text" as const, text: "振込口座" },
        element: {
          type: "plain_text_input" as const,
          action_id: "bank_info_input",
          initial_value: initialValues.bankInfo,
          placeholder: {
            type: "plain_text" as const,
            text: "例: 〇〇銀行 〇〇支店 普通 1234567",
          },
        },
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature") ?? "";
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";

  if (!verifySlackSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") ?? "{}");

  // ケース A・C: ボタンクリック
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) return new NextResponse(null, { status: 200 });

    // ケース A: 登録ボタン → モーダルを開く
    if (action.action_id === "open_registration_modal") {
      await slack.views.open({
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "invoice_modal",
          title: { type: "plain_text", text: "請求書リマインダー登録" },
          submit: { type: "plain_text", text: "登録する" },
          close: { type: "plain_text", text: "キャンセル" },
          blocks: [
            {
              type: "input",
              block_id: "recipient_block",
              label: { type: "plain_text", text: "送付先" },
              element: {
                type: "plain_text_input",
                action_id: "recipient_input",
                placeholder: { type: "plain_text", text: "例: 株式会社〇〇" },
              },
            },
            {
              type: "input",
              block_id: "due_date_block",
              label: { type: "plain_text", text: "送付期日" },
              element: {
                type: "datepicker",
                action_id: "due_date_input",
              },
            },
          ],
        },
      });
      return new NextResponse(null, { status: 200 });
    }

    // ケース C: 完了ボタン → ステータス更新・メッセージ書き換え
    if (action.action_id === "complete_reminder") {
      const reminderId: string = action.value;
      const reminder = await getReminder(reminderId);

      if (!reminder || reminder.status !== "active") {
        return new NextResponse(null, { status: 200 });
      }

      await completeReminder(reminderId);

      const completedDate = new Date().toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await slack.chat.update({
        channel: payload.container.channel_id,
        ts: payload.container.message_ts,
        text: "送付完了済み",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `☑️ *送付完了済み*\n\n*送付先*: ${reminder.recipient}\n*期日*: ${formatDateJST(reminder.due_date)}\n*完了日*: ${completedDate}`,
            },
          },
        ],
      });

      return new NextResponse(null, { status: 200 });
    }

    // ケース D: インターン給与モーダルを開く
    if (action.action_id === "open_intern_salary_modal") {
      const userId: string = payload.user.id;
      const profile = await getInternProfile(userId);
      const currentMonth = getCurrentMonthJST();

      await slack.views.open({
        trigger_id: payload.trigger_id,
        view: buildInternSalaryModal(currentMonth, {
          name: profile?.name ?? "",
          phone: profile?.phone ?? "",
          unitPrice: profile?.unit_price?.toString() ?? "",
          workingHours: "",
          expenseTransport: "0",
          expenseTravel: "0",
          expenseAi: "0",
          bankInfo: profile?.bank_info ?? "",
        }),
      });

      return new NextResponse(null, { status: 200 });
    }

    // ケース F: 給与情報を確定して提出
    if (action.action_id === "confirm_intern_salary") {
      const userId: string = action.value;
      const pending = (await getPending(userId)) as InternSalaryPendingWithPhone | null;
      if (!pending) return new NextResponse(null, { status: 200 });

      const submittedAt = new Date().toISOString();
      const submission: InternSalarySubmission = {
        ...pending,
        id: uuidv4(),
        status: "submitted",
        submitted_at: submittedAt,
        paid_at: null,
      };

      await saveSubmission(submission);

      const profile: InternProfile = {
        slack_user_id: userId,
        name: pending.intern_name,
        phone: pending.phone,
        bank_info: pending.bank_info,
        unit_price: pending.unit_price,
        updated_at: submittedAt,
      };
      await saveInternProfile(profile);
      await deletePending(userId);

      await slack.chat.update({
        channel: payload.container.channel_id,
        ts: payload.container.message_ts,
        text: `✅ 給与情報を提出しました（${formatMonthJP(submission.month)}分）`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ 給与情報を提出しました（${formatMonthJP(submission.month)}分）\n提出日時: ${formatDateTimeJST(new Date())}`,
            },
          },
        ],
      });

      const managerDm = await slack.conversations.open({
        users: process.env.MANAGER_SLACK_ID!,
      });
      const managerChannelId = managerDm.channel?.id;

      if (managerChannelId) {
        await slack.chat.postMessage({
          channel: managerChannelId,
          text: "給与情報が提出されました",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📩 *給与情報が提出されました*\n\n*氏名*: ${submission.intern_name}\n*対象月*: ${formatMonthJP(submission.month)}\n*請求合計*: ${formatCurrency(submission.total_amount)}\n　内訳: 単価${formatCurrency(submission.unit_price)} × ${submission.working_hours}h + 経費${formatCurrency(submission.total_expense)}\n*振込先*: ${submission.bank_info}\n*振込期限*: ${formatDateJP(submission.payment_due)}`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  action_id: "mark_intern_paid",
                  style: "primary",
                  text: { type: "plain_text", text: "✅ 振込完了" },
                  value: submission.id,
                },
              ],
            },
          ],
        });
      }

      return new NextResponse(null, { status: 200 });
    }

    // ケース G: 確認DMから修正モーダルを再表示
    if (action.action_id === "edit_intern_salary") {
      const userId: string = action.value;
      const pending = (await getPending(userId)) as InternSalaryPendingWithPhone | null;
      if (!pending) return new NextResponse(null, { status: 200 });

      await slack.views.open({
        trigger_id: payload.trigger_id,
        view: buildInternSalaryModal(pending.month, {
          name: pending.intern_name,
          phone: pending.phone,
          unitPrice: String(pending.unit_price),
          workingHours: String(pending.working_hours),
          expenseTransport: String(pending.expense_transport),
          expenseTravel: String(pending.expense_travel),
          expenseAi: String(pending.expense_ai),
          bankInfo: pending.bank_info,
        }),
      });

      return new NextResponse(null, { status: 200 });
    }

    // ケース H: 管理者が振込完了をマーク
    if (action.action_id === "mark_intern_paid") {
      const submissionId: string = action.value;
      const submission = await getSubmission(submissionId);
      if (!submission || submission.status === "paid") {
        return new NextResponse(null, { status: 200 });
      }

      await markAsPaid(submissionId);

      await slack.chat.update({
        channel: payload.container.channel_id,
        ts: payload.container.message_ts,
        text: "☑️ 振込完了済み",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `☑️ 振込完了済み\n\n氏名: ${submission.intern_name} / ${formatMonthJP(submission.month)}分\n金額: ${formatCurrency(submission.total_amount)}\n完了日: ${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })}`,
            },
          },
        ],
      });

      return new NextResponse(null, { status: 200 });
    }
  }

  // ケース B: モーダル送信 → リマインダー保存・登録完了 DM 送信
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "invoice_modal"
  ) {
    const values = payload.view.state.values;
    const recipient: string =
      values.recipient_block.recipient_input.value;
    const dueDate: string =
      values.due_date_block.due_date_input.selected_date;
    const userId: string = payload.user.id;

    const reminder: Reminder = {
      id: uuidv4(),
      recipient,
      due_date: dueDate,
      user_id: userId,
      status: "active",
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    await saveReminder(reminder);

    const dmResult = await slack.conversations.open({ users: userId });
    const dmChannelId = dmResult.channel?.id;

    if (dmChannelId) {
      await slack.chat.postMessage({
        channel: dmChannelId,
        text: "リマインダーを登録しました",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ *リマインダーを登録しました*\n\n*送付先*: ${recipient}\n*期日*: ${formatDateJST(dueDate)}\n\n期日の3日前からリマインドします。`,
            },
          },
        ],
      });
    }

    // body が空 = モーダルを閉じる
    return new NextResponse(null, { status: 200 });
  }

  // ケース E: インターン給与モーダル送信
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "intern_salary_modal"
  ) {
    const values = payload.view.state.values;
    const userId: string = payload.user.id;

    const name: string = values.name_block.name_input.value.trim();
    const phone: string = values.phone_block.phone_input.value.trim();
    const unitPriceRaw: string = values.unit_price_block.unit_price_input.value.trim();
    const workingHoursRaw: string =
      values.working_hours_block.working_hours_input.value.trim();
    const expenseTransportRaw: string =
      values.expense_transport_block.expense_transport_input.value.trim();
    const expenseTravelRaw: string =
      values.expense_travel_block.expense_travel_input.value.trim();
    const expenseAiRaw: string =
      values.expense_ai_block.expense_ai_input.value.trim();
    const bankInfo: string = values.bank_info_block.bank_info_input.value.trim();

    const errors: Record<string, string> = {};

    if (!/^\d+$/.test(unitPriceRaw) || Number(unitPriceRaw) <= 0) {
      errors.unit_price_block = "単価は正の整数で入力してください。";
    }

    if (!/^\d+(\.\d+)?$/.test(workingHoursRaw) || Number(workingHoursRaw) <= 0) {
      errors.working_hours_block = "稼働時間は正の数値で入力してください。";
    }

    if (!/^\d+$/.test(expenseTransportRaw) || Number(expenseTransportRaw) < 0) {
      errors.expense_transport_block = "移動費は0以上の整数で入力してください。";
    }

    if (!/^\d+$/.test(expenseTravelRaw) || Number(expenseTravelRaw) < 0) {
      errors.expense_travel_block = "交通費は0以上の整数で入力してください。";
    }

    if (!/^\d+$/.test(expenseAiRaw) || Number(expenseAiRaw) < 0) {
      errors.expense_ai_block = "AI利用費は0以上の整数で入力してください。";
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          response_action: "errors",
          errors,
        },
        { status: 200 }
      );
    }

    let month = getCurrentMonthJST();
    if (payload.view.private_metadata) {
      try {
        const metadata = JSON.parse(payload.view.private_metadata) as {
          month?: string;
        };
        if (metadata.month) month = metadata.month;
      } catch (error) {
        console.error(error);
      }
    }

    const unitPrice = Number(unitPriceRaw);
    const workingHours = Number(workingHoursRaw);
    const expenseTransport = Number(expenseTransportRaw);
    const expenseTravel = Number(expenseTravelRaw);
    const expenseAi = Number(expenseAiRaw);

    const totalSalary = Math.floor(unitPrice * workingHours);
    const totalExpense = expenseTransport + expenseTravel + expenseAi;
    const totalAmount = totalSalary + totalExpense;
    const paymentDue = getLastDayOfNextMonth();

    const pending: InternSalaryPendingWithPhone = {
      intern_id: userId,
      intern_name: name,
      phone,
      month,
      unit_price: unitPrice,
      working_hours: workingHours,
      expense_transport: expenseTransport,
      expense_travel: expenseTravel,
      expense_ai: expenseAi,
      total_salary: totalSalary,
      total_expense: totalExpense,
      total_amount: totalAmount,
      bank_info: bankInfo,
      payment_due: paymentDue,
      pending_since: new Date().toISOString(),
    };

    await savePending(userId, pending);

    const dmResult = await slack.conversations.open({ users: userId });
    const dmChannelId = dmResult.channel?.id;

    if (dmChannelId) {
      await slack.chat.postMessage({
        channel: dmChannelId,
        text: "給与提出の確認",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `以下の内容で佐藤さんに送りますか？\n\n*氏名*: ${name}\n*電話番号*: ${phone}\n*対象月*: ${formatMonthJP(month)}\n*単価*: ${formatCurrency(unitPrice)}/時\n*稼働時間*: ${workingHours}時間\n*給与小計*: ${formatCurrency(totalSalary)}\n*経費内訳*:\n　移動費: ${formatCurrency(expenseTransport)}\n　交通費: ${formatCurrency(expenseTravel)}\n　AI利用費: ${formatCurrency(expenseAi)}\n*経費合計*: ${formatCurrency(totalExpense)}\n──────────────\n*請求合計: ${formatCurrency(totalAmount)}*\n*振込口座*: ${bankInfo}\n*振込期限*: ${formatDateJP(paymentDue)}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                action_id: "confirm_intern_salary",
                style: "primary",
                text: { type: "plain_text", text: "✅ 確定して送信" },
                value: userId,
              },
              {
                type: "button",
                action_id: "edit_intern_salary",
                text: { type: "plain_text", text: "✏️ 修正する" },
                value: userId,
              },
            ],
          },
        ],
      });
    }

    return new NextResponse(null, { status: 200 });
  }

  return new NextResponse(null, { status: 200 });
}
