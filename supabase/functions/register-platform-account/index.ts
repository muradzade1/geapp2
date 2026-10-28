import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RegistrationRole = "youth" | "trainer" | "youth_house";

type RegistrationPayload = {
  role: RegistrationRole;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  education?: string;
  employmentStatus?: string;
  youthHouseName?: string;
  specialization?: string;
  teachingDirection?: string;
  workplace?: string;
  workExperience?: string;
  bio?: string;
  houseName?: string;
  responsibleName?: string;
  responsibleEmail?: string;
};

const trim = (value: unknown) => typeof value === "string" ? value.trim() : "";
const validGender = (value: unknown) => value === "kişi" || value === "qadın" ? value : null;
const EDUCATION_VALUES = [
  "Orta təhsil",
  "Peşə təhsili",
  "Orta ixtisas təhsili",
  "Ali təhsil (bakalavriat)",
  "Ali təhsil (magistratura)",
  "Formal təhsil almamışam",
];
const EMPLOYMENT_VALUES = ["İşləyirəm", "Sahibkaram", "İşləmirəm"];
const validEducation = (value: unknown) => typeof value === "string" && EDUCATION_VALUES.includes(value) ? value : null;
const validEmployment = (value: unknown) => typeof value === "string" && EMPLOYMENT_VALUES.includes(value) ? value : null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json() as Partial<RegistrationPayload>;
    const role = body.role;
    const email = trim(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const requestedFirstName = trim(body.firstName);
    const requestedLastName = trim(body.lastName);
    const responsibleName = trim(body.responsibleName);
    const [responsibleFirstName = "", ...responsibleLastName] = responsibleName.split(/\s+/);
    const firstName = role === "youth_house" ? responsibleFirstName : requestedFirstName;
    const lastName = role === "youth_house" ? responsibleLastName.join(" ") || responsibleFirstName : requestedLastName;
    const houseName = trim(body.houseName);

    if (!role || !["youth", "trainer", "youth_house"].includes(role) || !email || !firstName || !lastName || password.length < 8 || (role === "youth_house" && !houseName)) {
      return new Response(JSON.stringify({ error: "Invalid registration data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      // E-poçt artıq qeydiyyatdadırsa, tətbiq dəqiq mesaj göstərə bilsin deyə xüsusi kod qaytarırıq.
      const errorCode = (createError as { code?: string } | null)?.code ?? "";
      const errorMessage = createError?.message ?? "";
      const alreadyExists = errorCode === "email_exists" || errorCode === "user_already_exists" ||
        /already (been )?registered|already exists/i.test(errorMessage);
      if (alreadyExists) {
        return new Response(JSON.stringify({ error: "Email already registered", code: "email_exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Registration could not be completed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      role,
      status: "pending",
      email,
      first_name: firstName,
      last_name: lastName,
      phone: trim(body.phone) || null,
      city: trim(body.city) || null,
      address: trim(body.address) || null,
      birth_date: trim(body.birthDate) || null,
      gender: validGender(body.gender),
      education: validEducation(body.education),
      employment_status: validEmployment(body.employmentStatus),
      youth_house_name: trim(body.youthHouseName) || null,
      specialization: trim(body.specialization) || null,
      teaching_direction: trim(body.teachingDirection) || null,
      workplace: trim(body.workplace) || null,
      work_experience: trim(body.workExperience) || null,
      bio: trim(body.bio) || null,
      house_name: houseName || null,
      responsible_name: responsibleName || null,
      responsible_email: trim(body.responsibleEmail).toLowerCase() || null,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Registration could not be completed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("register-platform-account failed", error);
    return new Response(JSON.stringify({ error: "Registration could not be completed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
