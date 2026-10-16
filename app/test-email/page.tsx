import { getCurrentUser } from "@/auth";
import AcceptanceEmail from "@/components/Emails/AcceptanceEmail";
import { render } from "@react-email/render";
import { notFound, redirect } from "next/navigation";

const page = async () => {
  if (process.env.NODE_ENV !== "development") notFound();

  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  const emailHtml = await render(AcceptanceEmail({ name: "John" }));

  return <div dangerouslySetInnerHTML={{ __html: emailHtml }} />;
};
export default page;
