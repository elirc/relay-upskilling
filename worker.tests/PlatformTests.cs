using Relay.Worker;
using Xunit;
using System.Security.Cryptography;
using System.IO.Compression;
public class PlatformTests
{
 [Theory][InlineData("+1 (415) 555-0123",true)][InlineData("415-555-0123",false)][InlineData("+0123456789",false)][InlineData("+441234567890",true)]
 public void PhoneCleanupNeverGuessesCountryCode(string phone,bool valid){
  var(data,errors)=ContactRules.Normalize(new(){["Name"]="  Ada   Lovelace ",["Email"]="ADA@EXAMPLE.COM",["Phone"]=phone},new(){["name"]="Name",["email"]="Email",["phone"]="Phone"},2,new(){["name"]="collapse_spaces",["phone"]="strip_phone_formatting"});
  Assert.Equal("Ada Lovelace",data["name"]);Assert.Equal(valid,errors.Count==0);
 }
 [Fact]public void V1IgnoresNewPhoneField(){var(data,errors)=ContactRules.Normalize(new(){["n"]="A",["e"]="a@example.com",["p"]="bad"},new(){["name"]="n",["email"]="e",["phone"]="p"},1);Assert.Empty(errors);Assert.False(data.ContainsKey("phone"));}
 [Fact]public void ContractsAreDistinctAndUnsupportedVersionsFail(){Assert.Equal(64,SchemaRegistry.Digest(1).Length);Assert.NotEqual(SchemaRegistry.Digest(1),SchemaRegistry.Digest(2));Assert.Throws<InvalidDataException>(()=>SchemaRegistry.Digest(3));}
 [Fact]public void LogicalCsvResumeHandlesQuotedNewlines(){
  var path=Path.GetTempFileName();try{File.WriteAllText(path,"Name,Email\r\n\"Ada\r\nLovelace\",a@example.com\r\nGrace,g@example.com\r\n");var hash=Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path)));using var cursor=new SourceCursor(path,hash,"csv",1);Assert.Equal("Grace",cursor.Read()!["Name"]);Assert.Equal(2,cursor.Position);Assert.Null(cursor.Read());}finally{File.Delete(path);}
 }
 [Fact]public void SourceMutationIsDetected(){var path=Path.GetTempFileName();try{File.WriteAllText(path,"Name,Email\nA,a@example.com");Assert.Throws<InvalidDataException>(()=>new SourceCursor(path,new string('0',64),"csv",0));}finally{File.Delete(path);}}
 [Fact]public void ExcelFormulaIsRejectedBeforeParsingCachedValues(){var path=Path.GetTempFileName();try{using(var zip=new ZipArchive(File.Create(path),ZipArchiveMode.Create)){using var text=new StreamWriter(zip.CreateEntry("xl/worksheets/sheet1.xml").Open());text.Write("<worksheet><sheetData><row><c><f>1+1</f><v>2</v></c></row></sheetData></worksheet>");}var hash=Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path)));var error=Assert.Throws<InvalidDataException>(()=>new SourceCursor(path,hash,"xlsx",0));Assert.Contains("formulas",error.Message);}finally{File.Delete(path);}}
}