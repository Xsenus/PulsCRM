using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PulsNext.Infrastructure;

/// <summary>
/// Ключи VAPID (RFC 8292): открытый — несжатая точка P-256 (65 байт), закрытый — 32 байта; оба в base64url.
/// </summary>
public sealed record WebPushVapidKeys(string PublicKey, string PrivateKey)
{
    public static WebPushVapidKeys Generate()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parameters = ecdsa.ExportParameters(true);
        return new WebPushVapidKeys(
            WebPushCrypto.ToBase64Url(WebPushCrypto.EncodePublicKey(parameters.Q)),
            WebPushCrypto.ToBase64Url(parameters.D!));
    }
}

/// <summary>
/// Шифрование содержимого Web Push (RFC 8291, aes128gcm по RFC 8188) и заголовок VAPID (RFC 8292)
/// встроенной криптографией .NET, без сторонних библиотек.
/// </summary>
public static class WebPushCrypto
{
    private const int RecordSize = 4096;
    private static readonly byte[] KeyInfoPrefix = Encoding.ASCII.GetBytes("WebPush: info\0");
    private static readonly byte[] CekInfo = Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0");
    private static readonly byte[] NonceInfo = Encoding.ASCII.GetBytes("Content-Encoding: nonce\0");

    /// <summary>
    /// Тело запроса к сервису push: заголовок (salt, rs, ключ сервера) + зашифрованная запись.
    /// asPrivateKey и salt задаются только в тестах (вектор RFC 8291), обычно они случайные.
    /// </summary>
    public static byte[] Encrypt(byte[] plaintext, string userAgentPublicKey, string authSecret, byte[]? asPrivateKey = null, byte[]? salt = null)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        var uaPublic = FromBase64Url(userAgentPublicKey);
        var auth = FromBase64Url(authSecret);
        if (uaPublic.Length != 65 || uaPublic[0] != 0x04)
        {
            throw new ArgumentException("Ключ подписки p256dh должен быть несжатой точкой P-256.", nameof(userAgentPublicKey));
        }

        if (auth.Length != 16)
        {
            throw new ArgumentException("Секрет подписки auth должен быть 16 байт.", nameof(authSecret));
        }

        salt ??= RandomNumberGenerator.GetBytes(16);
        using var serverKey = asPrivateKey is null
            ? ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256)
            : ECDiffieHellman.Create(PrivateParameters(asPrivateKey));
        var asPublic = EncodePublicKey(serverKey.ExportParameters(false).Q);

        using var uaKey = ECDiffieHellman.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = DecodePublicKey(uaPublic) });
        var ecdhSecret = serverKey.DeriveRawSecretAgreement(uaKey.PublicKey);

        // IKM = HKDF(auth, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public, 32)
        var keyInfo = Concat(KeyInfoPrefix, uaPublic, asPublic);
        var ikm = HKDF.DeriveKey(HashAlgorithmName.SHA256, ecdhSecret, 32, auth, keyInfo);
        var cek = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 16, salt, CekInfo);
        var nonce = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 12, salt, NonceInfo);

        // Одна запись: данные + разделитель 0x02 (последняя запись), без дополнительного выравнивания.
        if (plaintext.Length + 1 + 16 > RecordSize - 86)
        {
            throw new ArgumentException("Слишком большое содержимое для одного уведомления.", nameof(plaintext));
        }

        var padded = new byte[plaintext.Length + 1];
        plaintext.CopyTo(padded, 0);
        padded[^1] = 0x02;
        var ciphertext = new byte[padded.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(cek, 16))
        {
            aes.Encrypt(nonce, padded, ciphertext, tag);
        }

        var header = new byte[16 + 4 + 1 + asPublic.Length];
        salt.CopyTo(header, 0);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(16, 4), RecordSize);
        header[20] = (byte)asPublic.Length;
        asPublic.CopyTo(header, 21);
        return Concat(header, ciphertext, tag);
    }

    /// <summary>
    /// Заголовок Authorization: «vapid t=&lt;JWT ES256&gt;, k=&lt;открытый ключ&gt;»; aud — источник адреса подписки.
    /// </summary>
    public static string CreateVapidAuthorization(string endpoint, WebPushVapidKeys keys, string subject, DateTimeOffset now)
    {
        var uri = new Uri(endpoint);
        var audience = uri.GetLeftPart(UriPartial.Authority);
        var header = ToBase64Url(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
        var claims = ToBase64Url(JsonSerializer.SerializeToUtf8Bytes(new Dictionary<string, object>
        {
            ["aud"] = audience,
            ["exp"] = now.AddHours(12).ToUnixTimeSeconds(),
            ["sub"] = subject
        }));
        var signingInput = Encoding.ASCII.GetBytes($"{header}.{claims}");
        using var ecdsa = ECDsa.Create(PrivateParameters(FromBase64Url(keys.PrivateKey)));
        var signature = ecdsa.SignData(signingInput, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return $"vapid t={header}.{claims}.{ToBase64Url(signature)}, k={keys.PublicKey}";
    }

    public static byte[] EncodePublicKey(ECPoint point)
        => Concat([0x04], point.X!, point.Y!);

    public static ECPoint DecodePublicKey(byte[] uncompressed)
        => new() { X = uncompressed[1..33], Y = uncompressed[33..65] };

    public static string ToBase64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[] FromBase64Url(string value)
    {
        var base64 = value.Trim().Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '='));
    }

    private static ECParameters PrivateParameters(byte[] privateKey)
    {
        // Открытую точку по закрытому ключу восстанавливает сама платформа при импорте только D.
        using var temp = ECDiffieHellman.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, D = privateKey });
        return temp.ExportParameters(true);
    }

    private static byte[] Concat(params byte[][] parts)
    {
        var result = new byte[parts.Sum(x => x.Length)];
        var offset = 0;
        foreach (var part in parts)
        {
            part.CopyTo(result, offset);
            offset += part.Length;
        }

        return result;
    }
}
