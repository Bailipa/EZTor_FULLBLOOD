CREATE TABLE "ExamResource" (
  "filename" TEXT NOT NULL PRIMARY KEY,
  "sha256" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "contentType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ExamPaperResource" (
  "paperId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  CONSTRAINT "ExamPaperResource_pkey" PRIMARY KEY ("paperId", "filename"),
  CONSTRAINT "ExamPaperResource_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ExamPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamPaperResource_filename_fkey" FOREIGN KEY ("filename") REFERENCES "ExamResource"("filename") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ExamPaperResource_filename_idx" ON "ExamPaperResource"("filename");
