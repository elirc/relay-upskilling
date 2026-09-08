FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NuGet.config ./
COPY worker/ ./worker/
COPY contracts/ ./contracts/
RUN dotnet publish worker/Relay.Worker.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /out .
ENTRYPOINT ["dotnet","Relay.Worker.dll"]
