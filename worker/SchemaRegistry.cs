using System.Text;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Security.Cryptography;
namespace Relay.Worker;
public static class SchemaRegistry {
 static readonly Dictionary<int,(string Digest,string[] Fields)> Schemas=Load();
 static Dictionary<int,(string,string[])> Load(){
  using var doc=JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","contact-schemas.json")));
  return doc.RootElement.GetProperty("schemas").EnumerateArray().ToDictionary(s=>s.GetProperty("version").GetInt32(),s=>(
   Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(s,new JsonSerializerOptions{Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping})))),
   s.GetProperty("fields").EnumerateArray().Select(f=>f.GetProperty("key").GetString()!).ToArray()));
 }
 public static int[] Versions=>Schemas.Keys.Order().ToArray();
 public static string Digest(int version)=>Schemas.TryGetValue(version,out var s)?s.Digest:throw new InvalidDataException("Unsupported destination schema version.");
 public static string[] Fields(int version)=>Schemas.TryGetValue(version,out var s)?s.Fields:throw new InvalidDataException("Unsupported destination schema version.");
}
