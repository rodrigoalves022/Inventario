import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@inventario.local";
  const password = "admin";
  
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    console.log("Admin user already exists!");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  await prisma.user.create({
    data: {
      email,
      name: "Administrador",
      password: hashedPassword,
      role: "admin",
    }
  });

  console.log("Admin user created successfully!");
  console.log("Email:", email);
  console.log("Password:", password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
