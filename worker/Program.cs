using Relay.Worker;
using Npgsql;
var builder = Host.CreateApplicationBuilder(args);
var connection = builder.Configuration.GetConnectionString("Relay")
    ?? throw new InvalidOperationException("Set ConnectionStrings__Relay.");
builder.Services.AddSingleton(NpgsqlDataSource.Create(connection));
builder.Services.AddHostedService<ImportWorker>();
await builder.Build().RunAsync();
