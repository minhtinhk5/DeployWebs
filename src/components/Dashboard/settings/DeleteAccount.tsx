"use client";

import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";

export default function DeleteAccount() {
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const t = toast.loading("Đang xóa tài khoản...");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      }).then((r) => r.json());

      toast.dismiss(t);
      if (!res?.success) {
        toast.error(res?.message || "Xóa thất bại");
        return;
      }
      toast.success(res.message);
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.dismiss(t);
      toast.error("Xóa thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-10 flex flex-row gap-x-5 rounded-md border-[1px] border-pink-700 bg-pink-900 p-8 px-12">
      <div className="flex items-center justify-center bg-pink-700 rounded-full aspect-square h-14 w-14 shrink-0">
        <FiTrash2 className="text-3xl text-pink-200" />
      </div>
      <div className="flex flex-col space-y-2">
        <h2 className="text-lg font-semibold text-richblack-5">Delete Account</h2>
        <div className="md:w-3/5 text-pink-25">
          <p>Would you like to delete account?</p>
          <p>
            This account may contain Paid Courses. Deleting your account is
            permanent and will remove all the contents associated with it.
          </p>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="italic text-pink-300 cursor-pointer w-fit"
          >
            I want to delete my account.
          </button>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-pink-100">
              Gõ email <b>{data?.user?.email}</b> để xác nhận:
            </p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="form-style"
              placeholder="Email của bạn"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading || !confirmEmail}
                onClick={handleDelete}
                className="rounded-md bg-pink-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Xóa vĩnh viễn
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmEmail("");
                }}
                className="rounded-md bg-richblack-700 px-4 py-2 font-semibold text-richblack-50"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
