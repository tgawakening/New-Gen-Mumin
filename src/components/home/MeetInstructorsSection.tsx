"use client";

import { useRef } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";

const INSTRUCTORS = [
  {
    src: "/images/ustad-abubakar.png",
    name: "Ustadh Abubakar Sadique",
    role: "Program Lead Coordinator",
    bio: "Hafiz-e-Qur'an with formal Islamic education. Holds AD & BS from the University of the Punjab. Certified in Teacher Training, Islamic Finance (Kuwait University), Arabic Language, and School Management.",
  },
  {
    src: "/images/ustad-mehran.png",
    name: "Ustadh Mehran Raziq",
    role: "Head-Teacher",
    bio: "F.Sc background and Dars-e-Nizami graduate. Specialized in Fiqh and Hadith with 2 years of teaching experience in Arabic and Islamic studies, focused on building strong foundations in classical knowledge.",
  },
  {
    src: "/images/ustad-mussab.png",
    name: "Brother Mussab Anwar",
    role: "Leadership skills Teacher",
    bio: "Professionally serving as an Agriculture Expert Officer in the UAE. An active student of the Arabic language, bringing a unique blend of professional insight and passion for Islamic learning and growth.",
  },
  {
    src: "/images/ustad-afira.png",
    name: "Ustadha Afira Tahir",
    role: "Spoken Arabic Teacher",
    bio: "Bachelor’s degree holder with 6 years of Islamic studies. Over 7 years of international experience teaching Arabic grammar to children. Renowned for clear, student-focused, and engaging teaching methods.",
  },
  {
    src: "/images/ustad-zeba.png",
    name: "Sister Javeria Khuram",
    role: "Seerah Instructor",
    bio: "Supports the Seerah pathway with child-friendly storytelling, reflective discussion, and weekly lesson guidance that helps families connect Prophetic character with daily life.",
  },
  {
    src: "/images/ustad-nimra.png",
    name: "Sister Sabah",
    role: "Seerah Instructor",
    bio: "Contributes to the Seerah stream through nurturing class delivery, engaging follow-up prompts, and practical reflection activities that keep children connected to the weekly Prophetic lessons.",
  },
];

export function MeetInstructorsSection() {
  const swiperRef = useRef<SwiperType | null>(null);

  return (
    <section className="relative py-16 md:py-20 lg:py-24 bg-[#FDF6EF] overflow-hidden">
      {/* Top: wavy strip (bottom.png rotated 180) */}
      <div className="absolute top-0 left-0 right-0 z-0 pointer-events-none" aria-hidden>
        <Image
          src="/images/bottom.png"
          alt=""
          width={1024}
          height={77}
          className="w-full h-auto object-cover object-bottom rotate-180"
        />
      </div>
      <div className="absolute top-50 right-0 z-0 pointer-events-none" aria-hidden>
        <Image
          src="/images/clouds.png"
          alt=""
          width={180}
          height={120}
          className="object-cover animate-sway-reverse"
        />
      </div>
      <div className="absolute bottom-10 left-25 z-0 pointer-events-none" aria-hidden>
        <Image
          src="/images/love.png"
          alt=""
          width={180}
          height={120}
          className="object-cover animate-float"
        />
      </div>

      {/* Decorative arc / star on the right (light orange) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 md:w-64 h-64 md:h-80 pointer-events-none opacity-40" aria-hidden>
        <div className="absolute inset-0 rounded-full border-[20px] border-amber-200/60 -translate-x-1/2" />
        <div className="absolute top-1/2 right-8 w-3 h-3 rounded-full bg-amber-300/80" />
      </div>

      <div className="section-container relative z-10">
        {/* Header: tagline + title + nav arrows (arrows above/right of title as in screenshot) */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 md:mb-10">
          <div>
            <p className="text-amber-500 font-semibold text-sm md:text-base mb-1">
              A Team Dedicated To Faith, Knowledge, And Leadership.
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#334155]">
              Meet Our Instructors
            </h2>
          </div>
          {/* Slider navigation: left (light gray), right (orange) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => swiperRef.current?.slidePrev()}
              className="w-11 h-11 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors text-[#334155]"
              aria-label="Previous instructor"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => swiperRef.current?.slideNext()}
              className="w-11 h-11 rounded-full bg-kidsa-oragne-500 flex items-center justify-center transition-colors text-white"
              aria-label="Next instructor"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Padding around the main swiper; top padding so profile (outside slide) is visible */}
        <div className="px-4 md:px-6 lg:px-8 pt-10 instructors-swiper-wrap">
          <Swiper
            spaceBetween={24}
            slidesPerView={1}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
            }}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            loop={true}
            className="!overflow-visible !pb-2"
          >
            {INSTRUCTORS.map((instructor) => (
              <SwiperSlide key={instructor.name}>
                <div className="flex flex-col items-center h-full pt-8">
                  {/* Profile above the white container */}
                  <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 border-4 border-white shadow-md -mb-8 z-10">
                    <Image src={instructor.src} alt={instructor.name} width={64} height={64} className="h-16 w-16 object-cover" />
                  </div>
                  <div className=" text-center items-center bg-white rounded-xl pt-10 pb-5 px-5 md:pt-12 md:pb-6 md:px-6 shadow-lg border border-gray-100 w-full flex flex-col text-left flex-1 min-h-0">
                    <h3 className="font-bold text-black text-lg mb-1">{instructor.name}</h3>
                    <p className="text-amber-500 font-medium text-sm mb-3">{instructor.role}</p>
                    <p className="text-[#64748b] text-center text-sm leading-relaxed flex-1">
                      {instructor.bio}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
