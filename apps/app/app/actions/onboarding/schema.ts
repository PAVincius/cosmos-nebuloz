import { z } from "zod";

export const FlowTypeSchema = z.enum(["company_setup", "migration_setup"]);
export type FlowType = z.infer<typeof FlowTypeSchema>;

export const SaveStepSchema = z.object({
  flowType: FlowTypeSchema,
  stepKey: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  data: z.record(z.string(), z.unknown()),
});
export type SaveStepInput = z.infer<typeof SaveStepSchema>;

export const CompanyProfileSchema = z.object({
  legalName: z.string().min(1).max(200).trim(),
  displayName: z.string().min(1).max(200).trim(),
  country: z.string().min(2).max(10),
  timezone: z.string().min(1),
  locale: z.string().min(2).max(10).default("pt-BR"),
  emailDomains: z.array(z.string()).optional(),
});
export type CompanyProfileData = z.infer<typeof CompanyProfileSchema>;

export const SafeStructureItemSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().optional(),
});

export const ARTInputSchema = SafeStructureItemSchema.extend({
  cadence: z.number().int().min(4).max(26).default(10),
});

export const ValueStreamInputSchema = SafeStructureItemSchema.extend({
  arts: z.array(ARTInputSchema).min(1),
});

export const SafeStructureSchema = z.object({
  portfolioName: z.string().min(1).max(200).trim(),
  portfolioDescription: z.string().optional(),
  valueStreams: z.array(ValueStreamInputSchema).min(1),
});
export type SafeStructureData = z.infer<typeof SafeStructureSchema>;

export const SectorsSchema = z.object({
  departments: z.array(
    z.object({
      name: z.string().min(1).max(200).trim(),
      description: z.string().optional(),
    })
  ),
  businessUnits: z.array(z.object({ name: z.string().min(1).max(200).trim() })),
});
export type SectorsData = z.infer<typeof SectorsSchema>;

export const OrgChartSchema = z.object({
  nodes: z.array(
    z.object({
      name: z.string().min(1).max(200).trim(),
      role: z.string().optional(),
      parentName: z.string().optional(),
    })
  ),
});
export type OrgChartData = z.infer<typeof OrgChartSchema>;

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  safeRole: z.enum([
    "RTE",
    "LPM",
    "PM",
    "SYSTEM_ARCHITECT",
    "PO",
    "SM",
    "DEVELOPER",
    "BUSINESS_OWNER",
  ]),
  teamName: z.string().optional(),
});

export const UsersTeamsSchema = z.object({
  invites: z.array(InviteUserSchema),
  teams: z.array(
    z.object({
      name: z.string().min(1).max(200).trim(),
      artName: z.string().optional(),
      memberEmails: z.array(z.string().email()).optional(),
    })
  ),
});
export type UsersTeamsData = z.infer<typeof UsersTeamsSchema>;

export const PISprintsSchema = z
  .object({
    piName: z.string().min(1).max(200).trim(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    iterationCount: z.number().int().min(2).max(8).default(5),
    sprintLengthDays: z.number().int().min(7).max(21).default(14),
    artName: z.string().min(1),
  })
  .refine((d) => !d.endDate || d.endDate > d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });
export type PISprintsData = z.infer<typeof PISprintsSchema>;
