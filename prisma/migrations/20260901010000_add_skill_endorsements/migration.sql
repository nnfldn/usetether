-- CreateTable
CREATE TABLE "skill_endorsements" (
    "id" TEXT NOT NULL,
    "profileSkillId" TEXT NOT NULL,
    "endorserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_endorsements_profileSkillId_endorserId_key" ON "skill_endorsements"("profileSkillId", "endorserId");

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_profileSkillId_fkey" FOREIGN KEY ("profileSkillId") REFERENCES "profile_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_endorserId_fkey" FOREIGN KEY ("endorserId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

