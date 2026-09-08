using System.Globalization;
using System.Text.RegularExpressions;
namespace Relay.Worker;
public static partial class ContactRules
{
    public static readonly string[] Fields = ["name", "email", "company", "joined_at"];
    public static Dictionary<string,string> Suggest(string[] headers)
    {
        Dictionary<string,string[]> aliases = new() {
            ["name"] = ["name","fullname","contactname"],
            ["email"] = ["email","emailaddress","emailid"],
            ["company"] = ["company","companyname","organization"],
            ["joined_at"] = ["joinedat","signupdate","createdat","datejoined"],
            ["phone"] = ["phone","phonenumber","telephone","mobile"]
        };
        Dictionary<string,string> result = new();
        foreach (var (field,names) in aliases) {
            var candidates = headers.Where(h => names.Contains(NonLetter().Replace(h.ToLowerInvariant(),""))).ToArray();
            if (candidates.Length == 1) result[field] = candidates[0];
        }
        return result;
    }
    public static (Dictionary<string,string> Data,List<string> Errors) Normalize(Dictionary<string,string> raw,Dictionary<string,string> mapping,int schema=1,Dictionary<string,string>? transforms=null)
    {
        string Get(string field) => mapping.TryGetValue(field,out var column) && raw.TryGetValue(column,out var value) ? value.Trim() : "";
        Dictionary<string,string> data = new() {
            ["name"]=Get("name"), ["email"]=Get("email").ToLowerInvariant(),
            ["company"]=Get("company"), ["joined_at"]=Get("joined_at")
        };
        List<string> errors=[];
        if(schema is not (1 or 2)) throw new InvalidDataException("Unsupported schema version.");
        foreach(var field in new[]{"name","company"})
            if(transforms?.GetValueOrDefault(field)=="collapse_spaces") data[field]=Regex.Replace(data[field],@"\s+"," ");
        if(schema==2) {
            data["phone"]=Get("phone");
            if(transforms?.GetValueOrDefault("phone")=="strip_phone_formatting") data["phone"]=Regex.Replace(data["phone"],@"[\s().-]","");
            if(data["phone"]!="" && !Regex.IsMatch(data["phone"],@"^\+[1-9][0-9]{7,14}$")) errors.Add("Phone must include a country code in international format, e.g. +14155550123.");
        }
        if(string.IsNullOrWhiteSpace(data["name"])) errors.Add("Full name is required.");
        if(data["name"].Length > 200) errors.Add("Full name must be 200 characters or fewer.");
        if(data["email"].Length>254 || !EmailPattern().IsMatch(data["email"])) errors.Add("A valid email address is required.");
        if(data["company"].Length>300) errors.Add("Company must be 300 characters or fewer.");
        if(data["joined_at"] != "") {
            if(DateOnly.TryParseExact(data["joined_at"],["yyyy-MM-dd","yyyy/MM/dd"],CultureInfo.InvariantCulture,DateTimeStyles.None,out var date))
                data["joined_at"]=date.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture);
            else errors.Add("Signup date is ambiguous or invalid. Use YYYY-MM-DD.");
        }
        return (data,errors);
    }
    [GeneratedRegex("[^a-z]")] private static partial Regex NonLetter();
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")] private static partial Regex EmailPattern();
}
