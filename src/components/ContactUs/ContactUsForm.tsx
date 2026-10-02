"use client";

import CountryCode from "@/data/countrycode.json";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";

export default function ContactUsForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    setLoading(true);
    const toastId = toast.loading("Đang gửi...");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      toast.dismiss(toastId);
      if (!res?.success) {
        toast.error(res?.message || "Gửi thất bại");
        return;
      }
      toast.success(res.message);
      form.reset();
    } catch {
      toast.dismiss(toastId);
      toast.error("Gửi thất bại, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7">
      {/* honeypot: ẩn với người thật, bot tự điền sẽ bị bỏ qua */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex flex-col gap-2 lg:w-[48%]">
          <label htmlFor="firstname" className="label-style">
            First Name
          </label>
          <input
            id="firstname"
            type="text"
            className="form-style"
            name="firstname"
            placeholder="Enter first name"
            maxLength={50}
            required
          />
        </div>
        <div className="flex flex-col gap-2 lg:w-[48%]">
          <label htmlFor="lastname" className="label-style">
            Last Name
          </label>
          <input
            id="lastname"
            type="text"
            name="lastname"
            placeholder="Enter last name"
            className="form-style"
            maxLength={50}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label-style">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="Enter email address"
          className="form-style"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="phonenumber" className="label-style">
          Phone Number
        </label>

        <div className="flex items-center gap-5">
          <div className="flex w-[81px] flex-col gap-2">
            <select name="countrycode" className="form-style" defaultValue="+84">
              {CountryCode.map((ele, i) => (
                <option key={i} value={ele.code}>
                  {ele.code} - {ele.country}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[calc(100%-90px)] flex-col gap-2">
            <input
              id="phonenumber"
              type="tel"
              name="phonenumber"
              placeholder="12345 67890"
              className="form-style"
              maxLength={20}
              required
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="label-style">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          cols={30}
          rows={7}
          placeholder="Enter your message here"
          className="form-style"
          maxLength={2000}
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-[8px] bg-yellow-50 py-[8px] px-[12px] font-bold text-richblack-900 disabled:opacity-60"
      >
        {loading ? "Đang gửi..." : "Send Message"}
      </button>
    </form>
  );
}
