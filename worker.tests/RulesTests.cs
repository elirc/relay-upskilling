using Relay.Worker;
using Xunit;
public class RulesTests
{
 static readonly Dictionary<string,string> Mapping=new(){["name"]="Name",["email"]="Email",["joined_at"]="Date"};
 [Fact] public void AmbiguousDatesAreRejectedInsteadOfGuessed(){
  var (data,errors)=ContactRules.Normalize(new(){["Name"]=" Alex ",["Email"]=" A@EXAMPLE.COM ",["Date"]="03/04/2025"},Mapping);
  Assert.Equal("Alex",data["name"]);Assert.Equal("a@example.com",data["email"]);Assert.Contains(errors,e=>e.Contains("ambiguous"));
 }
 [Theory] [InlineData("2025/01/15","2025-01-15")] [InlineData("2024-02-29","2024-02-29")]
 public void UnambiguousDatesNormalize(string input,string expected){
  var(data,errors)=ContactRules.Normalize(new(){["Name"]="Alex",["Email"]="a@example.com",["Date"]=input},Mapping);
  Assert.Empty(errors);Assert.Equal(expected,data["joined_at"]);
 }
 [Theory] [InlineData("2025-02-29")] [InlineData("2025-13-01")] [InlineData("yesterday")]
 public void ImpossibleDatesAreRejected(string input){
  var(_,errors)=ContactRules.Normalize(new(){["Name"]="Alex",["Email"]="a@example.com",["Date"]=input},Mapping);
  Assert.NotEmpty(errors);
 }
 [Fact] public void SuggestionsAbstainWhenMultipleHeadersMatch(){
  var mapping=ContactRules.Suggest(["Full Name","Name","Email Address","Signup Date"]);
  Assert.False(mapping.ContainsKey("name"));Assert.Equal("Email Address",mapping["email"]);
 }
 [Fact] public void MissingRequiredFieldsProduceSeparateErrors(){
  var(_,errors)=ContactRules.Normalize(new(),Mapping);Assert.Equal(2,errors.Count);
 }
}
