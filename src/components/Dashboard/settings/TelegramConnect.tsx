"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FaTelegramPlane } from "react-icons/fa";

type TgState = { linked: boolean; username: string | null; loginAlert: boolean };
type LinkInfo = {
  url: string;
  webUrl: string;
  code: string;
  bot: string;
  qr: string;
  expiresAt: number;
};

const isMobile = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function TelegramConnect() {
  const [tg, setTg] = useState<TgState | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (res?.success) setTg(res.user.telegram);
    return res?.user?.telegram as TgState | undefined;
  }, []);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    load();
    return stopPolling;
  }, [load]);

  // đồng hồ đếm ngược cho mã
  useEffect(() => {
    if (!link) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [link]);

  const startPolling = (expiresAt: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const state = await load();
      if (state?.linked) {
        stopPolling();
        setLink(null);
        toast.success("Đã kết nối Telegram!");
      } else if (Date.now() > expiresAt) {
        stopPolling();
      }
    }, 2500);
  };

  const connect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" }).then((r) => r.json());
      if (!res?.success) {
        toast.error(res?.message || "Không tạo được liên kết");
        return;
      }
      const info: LinkInfo = {
        url: res.url,
        webUrl: res.webUrl,
        code: res.code,
        bot: res.bot,
        qr: res.qr,
        expiresAt: Date.now() + (res.expiresInSec ?? 600) * 1000,
      };
      setLink(info);
      setNow(Date.now());
      startPolling(info.expiresAt);

      // Điện thoại: mở thẳng app Telegram
      if (isMobile()) window.location.href = info.url;
    } catch {
      toast.error("Không tạo được liên kết");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    stopPolling();
    setLink(null);
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" }).then((r) => r.json());
      if (res?.success) {
        toast.success(res.message);
        await load();
      } else toast.error(res?.message || "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  const toggleAlert = async (on: boolean) => {
    setTg((prev) => (prev ? { ...prev, loginAlert: on } : prev));
    const res = await fetch("/api/telegram/link", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginAlert: on }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.success) {
      toast.error("Không lưu được cài đặt");
      load();
    }
  };

  const copyCmd = (text: string) =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success("Đã copy"))
      .catch(() => toast.error("Không copy được, hãy chép tay"));

  const remaining = link ? Math.max(0, Math.floor((link.expiresAt - now) / 1000)) : 0;
  const expired = link && remaining === 0;

  return (
    <div className="my-10 flex flex-col gap-y-5 rounded-md border-[1px] border-richblack-700 bg-richblack-800 p-8 px-12 text-richblack-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#229ED9]">
          <FaTelegramPlane className="text-xl text-white" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Telegram</h2>
          <p className="text-sm text-richblack-300">
            Nhận cảnh báo đăng nhập, mã khôi phục mật khẩu và thông báo qua Telegram.
          </p>
        </div>
      </div>

      {!tg ? (
        <p className="text-sm text-richblack-300">Đang tải...</p>
      ) : tg.linked ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            ✅ Đã kết nối{tg.username ? <> với <b>@{tg.username}</b></> : null}
          </p>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={tg.loginAlert}
              onChange={(e) => toggleAlert(e.target.checked)}
              className="h-4 w-4 accent-yellow-50"
            />
            Gửi cảnh báo mỗi khi tài khoản đăng nhập
          </label>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="w-fit rounded-md bg-richblack-700 px-5 py-2 font-semibold text-richblack-50 disabled:opacity-50"
          >
            Hủy kết nối
          </button>
        </div>
      ) : !link ? (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="flex w-fit items-center gap-2 rounded-md bg-[#229ED9] px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          <FaTelegramPlane /> {busy ? "Đang tạo..." : "Kết nối Telegram"}
        </button>
      ) : expired ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-pink-200">Mã đã hết hạn.</p>
          <button
            type="button"
            onClick={connect}
            className="flex w-fit items-center gap-2 rounded-md bg-[#229ED9] px-5 py-2 font-semibold text-white"
          >
            <FaTelegramPlane /> Tạo mã mới
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-md border border-richblack-600 p-5 md:flex-row">
          {/* QR cho điện thoại */}
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.qr}
              alt="QR kết nối Telegram"
              width={180}
              height={180}
              className="rounded-md bg-white p-2"
            />
            <p className="text-xs text-richblack-300">Quét bằng camera điện thoại</p>
          </div>

          <div className="flex flex-1 flex-col gap-3 text-sm">
            <p className="font-semibold">Chọn 1 cách để kết nối:</p>
            <ol className="list-decimal space-y-1 pl-5 text-richblack-200">
              <li>Quét mã QR bằng điện thoại → bấm <b>Start</b>.</li>
              <li>Hoặc mở trên máy tính:</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a
                href={link.webUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-[#229ED9] px-4 py-2 font-semibold text-white"
              >
                Mở Telegram Web
              </a>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-richblack-700 px-4 py-2 font-semibold text-richblack-50"
              >
                Mở app Telegram
              </a>
            </div>

            <p className="pt-1 text-richblack-300">
              Bấm Start mà bot không phản hồi? Gửi lệnh này cho{" "}
              <b className="text-richblack-5">@{link.bot}</b>:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-richblack-900 px-2 py-1 text-yellow-50">
                /link {link.code}
              </code>
              <button
                type="button"
                onClick={() => copyCmd(`/link ${link.code}`)}
                className="rounded bg-richblack-700 px-3 py-1 font-semibold text-richblack-50"
              >
                Copy
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-yellow-50">
                ⏳ Đang chờ kết nối... {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
              <button type="button" onClick={cancel} className="text-richblack-300 underline">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
