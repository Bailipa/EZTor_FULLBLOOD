import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
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

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Parse the data (assuming first column is English word, second is Chinese translation)
    // We use header: 1 to get an array of arrays
    const rawData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    let savedCount = 0;
    let errorCount = 0;

    // Filter out empty rows and rows without at least 2 columns
    const wordsToImport = rawData
      .filter(row => row && row.length >= 2 && typeof row[0] === 'string' && row[0].trim() !== '')
      .map(row => ({
        word: row[0].trim().toLowerCase(),
        translation: row[1] ? String(row[1]).trim() : 'No translation provided'
      }));

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
            word: wordData.word,
            translation: wordData.translation,
            userId: session.user.id
          }
        });

        // 2. Add to public database
        await prisma.publicWord.create({
          data: {
            word: wordData.word.toLowerCase().trim(),
            translation: wordData.translation,
          }
        }).catch(() => {
          // Ignore unique constraint errors if it's already in the public bank
        });

        savedCount++;
      } catch (err) {
        console.error(`Failed to import flashcard word: ${wordData.word}`, err);
        errorCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Imported ${savedCount} words from Excel. Errors: ${errorCount}` 
    });

  } catch (error: any) {
    console.error("Flashcard Import API Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
