import { Prisma } from "@prisma/client";

export const completedOrderWhere = {
  OR: [
    { status: "SUCCEEDED" },
    { payments: { some: { status: "SUCCEEDED" } } },
    { registration: { is: { status: { in: ["PAID", "CONVERTED"] } } } },
  ],
} satisfies Prisma.OrderWhereInput;
