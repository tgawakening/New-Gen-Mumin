import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type InnerHeaderProps = {
  title: string;
  breadcrumbLabel: string;
};

export function InnerHeader({ title, breadcrumbLabel }: InnerHeaderProps) {
  return (
    <section className="relative bg-[url('/images/breadcrumb.png')] bg-cover bg-center bg-no-repeat isolate overflow-hidden">
      {/* <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
        <Image
          src="/images/breadcrumb.png"
          alt=""
          fill
          priority
          aria-hidden
          className=" object-cover inset-0"
        />
      </div> */}

      {/* Decorative ornaments reused from homepage banner assets */}
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div className="absolute top-[24%] left-[20%] hidden md:block">
          <Image src="/images/plane-1.png" alt="" width={120} height={220} className="opacity-90  animate-float" />
        </div>
        <div className="absolute right-[9%] top-7 hidden animate-float lg:block">
          <Image src="/images/parasuit.png" alt="" width={78} height={108} className="object-contain" />
        </div>
        <div className="absolute right-[24%] top-[24%] hidden animate-sway-reverse md:block">
          <Image src="/images/frame-4.png" alt="" width={70} height={70} className="object-contain opacity-90" />
        </div>
        <div className="absolute right-[20%] top-[62%] hidden animate-float-horizontal md:block">
          <Image src="/images/bee-1.png" alt=""  width={80} height={80} className="object-contain" />
        </div>
        <div className="absolute left-[15%] top-[66%] hidden animate-float-horizontal md:block">
          <Image src="/images/doll-1.png" alt="" width={70} height={70} className="object-contain" />
        </div>
      </div>

      <div className="section-container relative z-[2] flex min-h-[300px] flex-col items-center justify-center py-14 text-center text-white md:min-h-[360px] md:py-16">
        <h1 className="font-heading text-4xl font-bold leading-tight drop-shadow-sm md:text-[3.3rem]">{title}</h1>
        <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-white/95">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span>{breadcrumbLabel}</span>
        </div>
      </div>
    </section>
  );
}
