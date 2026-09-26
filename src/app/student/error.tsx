"use client";
import { FamilyPageError } from "@/components/dashboard/family/FamilyPageError";
export default function ErrorPage(props:{error:Error&{digest?:string};reset:()=>void}){return <FamilyPageError {...props} role="student"/>;}
