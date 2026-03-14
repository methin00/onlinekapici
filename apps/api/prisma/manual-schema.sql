-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'BUILDING_ADMIN', 'CONCIERGE', 'RESIDENT');

-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('WAITING', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('GUEST', 'CARGO', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceState" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "siteNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "DeviceState" NOT NULL DEFAULT 'ONLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "floorCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apartment" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floorCount" INTEGER NOT NULL,
    "temporaryPassword" TEXT,
    "passwordHash" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Apartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "apartmentId" TEXT,
    "floorNumber" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "ownerName" TEXT,
    "isVacant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT,
    "unitId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "temporaryPassword" TEXT,
    "passwordHash" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestLog" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "residentId" TEXT,
    "visitorName" TEXT NOT NULL,
    "visitorType" "VisitorType" NOT NULL,
    "status" "GuestStatus" NOT NULL DEFAULT 'WAITING',
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "GuestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrPass" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "residentId" TEXT,
    "approvedById" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorDevice" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "status" "DeviceState" NOT NULL DEFAULT 'ONLINE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConciergeBuildings" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "District_provinceId_name_idx" ON "District"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "District_provinceId_name_key" ON "District"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Province_code_key" ON "Province"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Province_name_key" ON "Province"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_slug_key" ON "Building"("slug");

-- CreateIndex
CREATE INDEX "Building_createdAt_idx" ON "Building"("createdAt");

-- CreateIndex
CREATE INDEX "Building_districtId_name_idx" ON "Building"("districtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_districtId_siteNumber_key" ON "Building"("districtId", "siteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Block_buildingId_sequence_key" ON "Block"("buildingId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Block_buildingId_name_key" ON "Block"("buildingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_code_key" ON "Apartment"("code");

-- CreateIndex
CREATE INDEX "Apartment_buildingId_code_idx" ON "Apartment"("buildingId", "code");

-- CreateIndex
CREATE INDEX "Apartment_buildingId_blockId_idx" ON "Apartment"("buildingId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_blockId_sequence_key" ON "Apartment"("blockId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Apartment_blockId_name_key" ON "Apartment"("blockId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_buildingId_code_idx" ON "Unit"("buildingId", "code");

-- CreateIndex
CREATE INDEX "Unit_buildingId_isVacant_idx" ON "Unit"("buildingId", "isVacant");

-- CreateIndex
CREATE INDEX "Unit_buildingId_apartmentId_isVacant_idx" ON "Unit"("buildingId", "apartmentId", "isVacant");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_apartmentId_floorNumber_number_key" ON "Unit"("apartmentId", "floorNumber", "number");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_buildingId_role_idx" ON "User"("buildingId", "role");

-- CreateIndex
CREATE INDEX "User_unitId_idx" ON "User"("unitId");

-- CreateIndex
CREATE INDEX "GuestLog_buildingId_status_createdAt_idx" ON "GuestLog"("buildingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GuestLog_residentId_createdAt_idx" ON "GuestLog"("residentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrPass_code_key" ON "QrPass"("code");

-- CreateIndex
CREATE INDEX "QrPass_buildingId_createdAt_idx" ON "QrPass"("buildingId", "createdAt");

-- CreateIndex
CREATE INDEX "QrPass_residentId_createdAt_idx" ON "QrPass"("residentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDevice_buildingId_key" ON "DoorDevice"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDevice_serialNo_key" ON "DoorDevice"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "_ConciergeBuildings_AB_unique" ON "_ConciergeBuildings"("A", "B");

-- CreateIndex
CREATE INDEX "_ConciergeBuildings_B_index" ON "_ConciergeBuildings"("B");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestLog" ADD CONSTRAINT "GuestLog_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestLog" ADD CONSTRAINT "GuestLog_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPass" ADD CONSTRAINT "QrPass_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPass" ADD CONSTRAINT "QrPass_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPass" ADD CONSTRAINT "QrPass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorDevice" ADD CONSTRAINT "DoorDevice_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConciergeBuildings" ADD CONSTRAINT "_ConciergeBuildings_A_fkey" FOREIGN KEY ("A") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConciergeBuildings" ADD CONSTRAINT "_ConciergeBuildings_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

