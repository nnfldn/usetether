-- CreateTable
CREATE TABLE "peer_ratings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "ratedId" TEXT NOT NULL,
    "timeliness" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "peer_ratings_ratedId_idx" ON "peer_ratings"("ratedId");

-- CreateIndex
CREATE UNIQUE INDEX "peer_ratings_projectId_raterId_ratedId_key" ON "peer_ratings"("projectId", "raterId", "ratedId");

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_ratings" ADD CONSTRAINT "peer_ratings_ratedId_fkey" FOREIGN KEY ("ratedId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Pagar integritas di lapisan DATABASE, bukan cuma di aplikasi.
-- Validasi zod di server action sudah menolak nilai di luar rentang, tapi
-- constraint ini menutup jalur lain (SQL langsung, skrip seed yang keliru,
-- Prisma Studio). Aturan anti-gaming tidak boleh bergantung pada satu
-- lapisan saja.
ALTER TABLE "peer_ratings"
  ADD CONSTRAINT "peer_ratings_skala_1_5" CHECK (
    "timeliness"    BETWEEN 1 AND 5 AND
    "quality"       BETWEEN 1 AND 5 AND
    "communication" BETWEEN 1 AND 5
  );

-- Tidak boleh menilai diri sendiri. Sejajar dengan ambang MIN_PEER_RATERS
-- di src/lib/matching/experience.ts.
ALTER TABLE "peer_ratings"
  ADD CONSTRAINT "peer_ratings_bukan_diri_sendiri" CHECK ("raterId" <> "ratedId");
