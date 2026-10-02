import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" aria-label="AI-Hunting">
        <Logo />
      </Link>
      <SearchX className="size-10 text-primary" />
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </div>
      <Link href="/app" className={buttonVariants({ size: "lg" }) + " w-fit"}>
        {t("back")}
      </Link>
    </main>
  );
}
