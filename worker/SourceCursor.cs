using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Xml;
using CsvHelper;
using CsvHelper.Configuration;
using ExcelDataReader;
namespace Relay.Worker;
// A cursor is a bounded reader, never a workbook DataSet. Durable progress remains in PostgreSQL.
internal sealed class SourceCursor : IDisposable
{
    readonly CsvReader? csv;
    readonly IExcelDataReader? excel;
    readonly Stream stream;
    public string[] Headers {get;}
    public int Position {get;private set;}
    public DateTime LastUsed {get;private set;}=DateTime.UtcNow;
    public SourceCursor(string path,string hash,string format,int skip)
    {
        stream=File.OpenRead(path);
        try {
            if(Convert.ToHexStringLower(SHA256.HashData(stream))!=hash) throw new InvalidDataException("Original file checksum changed. Upload the source again.");
            stream.Position=0;
            if(format=="xlsx") {
                Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
                using(var zip=new ZipArchive(stream,ZipArchiveMode.Read,true)) {
                    if(zip.Entries.Any(e=>(e.FullName=="xl/sharedStrings.xml"||e.FullName=="xl/styles.xml")&&e.Length>16L*1024*1024) || zip.Entries.Count>2000 || zip.Entries.Sum(e=>e.Length)>256L*1024*1024) throw new InvalidDataException("Workbook expands beyond the 256 MB limit.");
                    foreach(var entry in zip.Entries.Where(e=>e.FullName.StartsWith("xl/worksheets/") && e.FullName.EndsWith(".xml"))) {
                        using var xml=XmlReader.Create(entry.Open(),new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,MaxCharactersInDocument=256L*1024*1024});
                        while(xml.Read()) if(xml.NodeType==XmlNodeType.Element && xml.LocalName=="f") throw new InvalidDataException("Export formulas as values before uploading this workbook.");
                    }
                }
                stream.Position=0;
                excel=ExcelReaderFactory.CreateOpenXmlReader(stream);
                if(excel.ResultsCount!=1) throw new InvalidDataException("Use a workbook with exactly one worksheet.");
                if(!excel.Read()) throw new InvalidDataException("Workbook is empty.");
                Headers=Enumerable.Range(0,excel.FieldCount).Select(i=>Cell(excel.GetValue(i))).ToArray();
            } else {
                csv=new CsvReader(new StreamReader(stream,new UTF8Encoding(false,true),true),new CsvConfiguration(CultureInfo.InvariantCulture){HasHeaderRecord=true,DetectColumnCountChanges=true,MaxFieldSize=16000,ExceptionMessagesContainRawData=false,IgnoreBlankLines=false});
                if(!csv.Read()) throw new InvalidDataException("CSV is empty.");
                csv.ReadHeader(); Headers=csv.HeaderRecord??[];
            }
            if(Headers.Length is <1 or >100 || Headers.Any(h=>string.IsNullOrWhiteSpace(h)||h.Length>200) || Headers.Distinct().Count()!=Headers.Length) throw new InvalidDataException("Use 1-100 unique, nonempty column names of at most 200 characters.");
            for(var i=0;i<skip;i++) if(Read()==null) throw new InvalidDataException("Source ended before its durable checkpoint.");
        } catch {Dispose();throw;}
    }
    static string Cell(object? v)=>v switch {null=>"",DateTime d=>d.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture),IFormattable f=>f.ToString(null,CultureInfo.InvariantCulture)??"",_=>v.ToString()??""};
    public Dictionary<string,string>? Read()
    {
        LastUsed=DateTime.UtcNow;
        if(!(csv?.Read()??excel!.Read())) return null;
        if(++Position>200000) throw new InvalidDataException("File exceeds the 200,000-row limit.");
        var row=Headers.Select((h,i)=>(h,v:csv!=null?csv.GetField(i)??"":Cell(excel!.GetValue(i)))).ToDictionary(x=>x.h,x=>x.v);
        if(row.Values.Any(v=>v.Length>16000)) throw new InvalidDataException("A field exceeds the 16,000-character limit.");
        return row;
    }
    public void Dispose(){csv?.Dispose();excel?.Dispose();stream.Dispose();}
}