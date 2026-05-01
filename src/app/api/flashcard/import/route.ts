import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 50000;

export async function POST(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Load the Excel file from the root 'web' directory
    const filePath = path.join(process.cwd(), 'simple words.xlsx');
    
    if (!fs.existsSync(filePath)) {
       return NextResponse.json({ success: false, error: 'simple words.xlsx not found in the root directory.' }, { status: 404 });
    }

    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `File too large (${(stats.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is 10 MB.` }, { status: 413 });
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (rawData.length > MAX_ROWS) {
      return NextResponse.json({ success: false, error: `Too many rows (${rawData.length}). Maximum allowed is ${MAX_ROWS}.` }, { status: 413 });
    }

    let savedCount = 0;
    let errorCount = 0;

    const wordsToImport: Array<{ word: string; translation: string }> = [];
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row.length >= 2 && typeof row[0] === 'string' && row[0].trim() !== '') {
        wordsToImport.push({
          word: row[0].trim().toLowerCase(),
          translation: row[1] ? String(row[1]).trim() : 'No translation provided'
        });
      }
    }

    for (const wordData of wordsToImport) {
      try {
        // 1. Add to user's private database
        await prisma.word.upsert({
          where: { 
            word_userId: {
              word: wordData.word,
              userId: session.user.id
            }
          },
          update: {
            updatedAt: new Date()
          },
          create: {
            id: randomUUID(),
            word: wordData.word,
            translation: wordData.translation,
            userId: session.user.id,
            updatedAt: new Date(),
          }
        });

        // 2. Add to public database
        await prisma.publicWord.create({
          data: {
            id: randomUUID(),
            word: wordData.word.toLowerCase().trim(),
            translation: wordData.translation,
            updatedAt: new Date(),
          }
        }).catch(() => {
          // Ignore unique constraint errors if it's already in the public bank
        });

        savedCount++;
      } catch (err) {
        logger.error({ err: err }, `Failed to import flashcard word: ${wordData.word}`);
        errorCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Imported ${savedCount} words from Excel. Errors: ${errorCount}` 
    });

  } catch (error: any) {
    logger.error({ err: error }, "Flashcard Import API Error:");
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
