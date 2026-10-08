import Foundation
import PDFKit
import Vision
import CoreGraphics

struct Line: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
struct PageText: Codable {
    let page: Int
    let lines: [Line]
}

guard CommandLine.arguments.count == 3,
      let document = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    fatalError("Expected source PDF and destination JSON")
}
var pages: [PageText] = []
for index in 0..<document.pageCount {
    let page = document.page(at: index)!
    let rect = page.bounds(for: .mediaBox)
    let scale = 180.0 / 72.0
    let width = Int(rect.width * scale), height = Int(rect.height * scale)
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: context.makeImage()!).perform([request])
    let lines = (request.results ?? []).compactMap { observation -> Line? in
        guard let text = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return Line(text: text.string, confidence: text.confidence,
            x: box.minX, y: box.minY, width: box.width, height: box.height)
    }
    pages.append(PageText(page: index + 1, lines: lines))
}
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(pages).write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
print("OCR pages: \(pages.count)")
