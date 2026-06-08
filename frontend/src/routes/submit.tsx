import { createFileRoute, redirect } from "@tanstack/react-router";
import { ChangeEvent, useEffect, useState } from "react";
import { Camera, CheckCircle2, Loader2, MapPinned, Send } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pb } from "@/lib/pocketbase";

type Department = {
  id: string;
  name: string;
};

const categories = ["roads", "sanitation", "water", "electricity", "drainage", "other"] as const;

const categoryLabels: Record<(typeof categories)[number], string> = {
  roads: "Roads",
  sanitation: "Sanitation",
  water: "Water Supply",
  electricity: "Electricity / Streetlights",
  drainage: "Drainage",
  other: "Other",
};

function getPocketBaseErrorMessage(error: any) {
  const fieldErrors = error?.data?.data;
  if (fieldErrors && typeof fieldErrors === "object") {
    const messages = Object.entries(fieldErrors)
      .map(([field, value]: [string, any]) => `${field}: ${value?.message ?? "invalid value"}`)
      .join("; ");

    if (messages) {
      return `PocketBase rejected the complaint (${messages}). Check that your collection fields match the README exactly.`;
    }
  }

  return error?.message ?? "Could not submit complaint. Please try again.";
}

export const Route = createFileRoute("/submit")({
  beforeLoad: ({ location }) => {
    if (!pb.authStore.isValid) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  head: () => ({ meta: [{ title: "Submit Complaint — PGMS" }] }),
  component: SubmitComplaintPage,
});

interface GpsData {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  found: boolean;
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  } else {
    return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  }
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  } else {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }
}

function readRational(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const numerator = readUint32(bytes, offset, littleEndian);
  const denominator = readUint32(bytes, offset + 4, littleEndian);
  return denominator !== 0 ? numerator / denominator : 0;
}

async function extractGpsFromPhoto(file: File): Promise<GpsData> {
  const gpsData: GpsData = { latitude: null, longitude: null, altitude: null, found: false };

  try {
    const fileType = (file.type || "").toLowerCase();
    const isJpegFile = /^(image\/(jpeg|pjpeg|jpg))$/i.test(fileType) || /\.(jpe?g)$/i.test(file.name);
    
    if (!isJpegFile) {
      console.log("❌ Not a JPEG file");
      return gpsData;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      console.log("❌ Invalid JPEG header");
      return gpsData;
    }

    console.log("✓ Valid JPEG file, size:", bytes.length);

    // Search for EXIF data anywhere in file, not just APP1
    let exifOffset = -1;
    for (let i = 0; i < bytes.length - 6; i++) {
      if (
        bytes[i] === 0x45 && bytes[i + 1] === 0x78 && // 'E' 'x'
        bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 && // 'i' 'f'
        bytes[i + 4] === 0x00 && bytes[i + 5] === 0x00 // '\0' '\0'
      ) {
        exifOffset = i + 6;
        console.log("✓ Found EXIF header at offset", i, "TIFF start at", exifOffset);
        break;
      }
    }

    if (exifOffset === -1) {
      console.log("❌ No EXIF header found anywhere in file");
      return gpsData;
    }

    if (exifOffset + 8 > bytes.length) {
      console.log("❌ Not enough data for TIFF header at offset", exifOffset);
      return gpsData;
    }

    // Read byte order
    const byteOrder = (bytes[exifOffset] << 8) | bytes[exifOffset + 1];
    const littleEndian = byteOrder === 0x4949;

    console.log("✓ Byte order:", littleEndian ? "little-endian (Intel)" : "big-endian (Motorola)", "0x" + byteOrder.toString(16));

    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) {
      console.log("❌ Invalid TIFF byte order:", "0x" + byteOrder.toString(16));
      return gpsData;
    }

    // Read IFD0 offset
    const ifd0Offset = readUint32(bytes, exifOffset + 4, littleEndian);
    const ifd0Pos = exifOffset + ifd0Offset;

    console.log("✓ IFD0 offset:", ifd0Offset, "position:", ifd0Pos);

    if (ifd0Pos + 2 > bytes.length) {
      console.log("❌ IFD0 position out of bounds:", ifd0Pos);
      return gpsData;
    }

    const dirCount = readUint16(bytes, ifd0Pos, littleEndian);
    console.log("✓ IFD0 has", dirCount, "entries");

    // Find GPS IFD pointer in IFD0
    let gpsIfdOffset = -1;
    for (let j = 0; j < Math.min(dirCount, 5000); j++) {
      const entryPos = ifd0Pos + 2 + (j * 12);
      if (entryPos + 12 > bytes.length) {
        console.log("⚠ Reached end of IFD0 entries at", j);
        break;
      }

      const tag = readUint16(bytes, entryPos, littleEndian);
      
      if (tag === 0x8825) {
        gpsIfdOffset = readUint32(bytes, entryPos + 8, littleEndian);
        console.log("✓✓✓ Found GPS IFD pointer (0x8825) at entry", j, "offset:", gpsIfdOffset);
        break;
      }
    }

    if (gpsIfdOffset === -1) {
      console.log("❌ GPS IFD pointer (0x8825) not found in IFD0");
      // Try looking in IFD1 (thumbnail IFD)
      const nextIfdOffset = readUint32(bytes, ifd0Pos + 2 + (dirCount * 12), littleEndian);
      if (nextIfdOffset > 0 && nextIfdOffset < 100000) {
        console.log("⚠ Trying IFD1 at offset", nextIfdOffset);
        const ifd1Pos = exifOffset + nextIfdOffset;
        if (ifd1Pos + 2 <= bytes.length) {
          const ifd1Count = readUint16(bytes, ifd1Pos, littleEndian);
          for (let j = 0; j < Math.min(ifd1Count, 1000); j++) {
            const entryPos = ifd1Pos + 2 + (j * 12);
            if (entryPos + 12 > bytes.length) break;
            const tag = readUint16(bytes, entryPos, littleEndian);
            if (tag === 0x8825) {
              gpsIfdOffset = readUint32(bytes, entryPos + 8, littleEndian);
              console.log("✓ Found GPS IFD pointer in IFD1 at offset", gpsIfdOffset);
              break;
            }
          }
        }
      }
      
      if (gpsIfdOffset === -1) {
        return gpsData;
      }
    }

    const gpsIfdPos = exifOffset + gpsIfdOffset;

    console.log("✓ GPS IFD position:", gpsIfdPos);

    if (gpsIfdPos + 2 > bytes.length) {
      console.log("❌ GPS IFD position out of bounds:", gpsIfdPos);
      return gpsData;
    }

    const gpsEntryCount = readUint16(bytes, gpsIfdPos, littleEndian);
    console.log("✓ GPS IFD has", gpsEntryCount, "entries");

    if (gpsEntryCount === 0) {
      console.log("❌ GPS IFD is empty");
      return gpsData;
    }

    let latRef = "N", lonRef = "E";
    let lat: number[] = [], lon: number[] = [];

    // Parse GPS IFD entries
    for (let k = 0; k < Math.min(gpsEntryCount, 200); k++) {
      const entryPos = gpsIfdPos + 2 + (k * 12);
      if (entryPos + 12 > bytes.length) break;

      const tag = readUint16(bytes, entryPos, littleEndian);
      const format = readUint16(bytes, entryPos + 2, littleEndian);
      const count = readUint32(bytes, entryPos + 4, littleEndian);
      const valueOffset = entryPos + 8;

      // GPS Latitude Ref (0x0001)
      if (tag === 0x0001) {
        latRef = String.fromCharCode(bytes[valueOffset]);
        console.log("✓ GPS Latitude Ref:", latRef);
      }
      // GPS Latitude (0x0002) - format 5 is RATIONAL
      else if (tag === 0x0002 && format === 5 && count === 3) {
        const dataOffset = readUint32(bytes, valueOffset, littleEndian);
        const dataPos = exifOffset + dataOffset;
        if (dataPos + 24 <= bytes.length) {
          lat = [
            readRational(bytes, dataPos, littleEndian),
            readRational(bytes, dataPos + 8, littleEndian),
            readRational(bytes, dataPos + 16, littleEndian),
          ];
          console.log("✓ GPS Latitude found:", lat);
        }
      }
      // GPS Longitude Ref (0x0003)
      else if (tag === 0x0003) {
        lonRef = String.fromCharCode(bytes[valueOffset]);
        console.log("✓ GPS Longitude Ref:", lonRef);
      }
      // GPS Longitude (0x0004)
      else if (tag === 0x0004 && format === 5 && count === 3) {
        const dataOffset = readUint32(bytes, valueOffset, littleEndian);
        const dataPos = exifOffset + dataOffset;
        if (dataPos + 24 <= bytes.length) {
          lon = [
            readRational(bytes, dataPos, littleEndian),
            readRational(bytes, dataPos + 8, littleEndian),
            readRational(bytes, dataPos + 16, littleEndian),
          ];
          console.log("✓ GPS Longitude found:", lon);
        }
      }
    }

    // Convert DMS to decimal
    if (lat.length === 3 && lon.length === 3) {
      const latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
      const longitude = lon[0] + lon[1] / 60 + lon[2] / 3600;

      gpsData.latitude = latRef === "S" ? -latitude : latitude;
      gpsData.longitude = lonRef === "W" ? -longitude : longitude;
      gpsData.found = true;

      console.log("🎉🎉🎉 GPS DATA SUCCESSFULLY EXTRACTED 🎉🎉🎉");
      console.log("Latitude:", gpsData.latitude.toFixed(6));
      console.log("Longitude:", gpsData.longitude.toFixed(6));
    } else {
      console.log("❌ GPS coordinates incomplete - Lat:", lat.length, "Lon:", lon.length);
    }

    return gpsData;
  } catch (error) {
    console.error("❌ GPS extraction error:", error);
    return gpsData;
  }
}

function SubmitComplaintPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"" | (typeof categories)[number]>("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoValidating, setPhotoValidating] = useState(false);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDepartments() {
      try {
        const items = await pb.collection("departments").getFullList<Department>({
          sort: "name",
        });

        if (!mounted) return;
        setDepartments(items);
      } catch {
        if (!mounted) return;
        setDepartments([]);
      } finally {
        if (mounted) {
          setDepartmentsLoading(false);
        }
      }
    }

    loadDepartments();

    return () => {
      mounted = false;
    };
  }, []);

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setError(null);
    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocationLoading(false);
      },
      () => {
        setError("Could not fetch your location. You can also type latitude and longitude manually.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessId(null);

    if (!category) {
      setError("Please select a category for your complaint.");
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Please enter a valid latitude and longitude (or use the GPS button).");
      return;
    }

    if (!photo) {
      setError("Please upload one GPS-tagged photo as proof of the issue.");
      return;
    }

    if (!photoConfirmed) {
      setError("Please confirm that the photo is related to your complaint.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("status", "pending");
      formData.append("latitude", String(lat));
      formData.append("longitude", String(lng));
      formData.append("citizen", pb.authStore.model?.id ?? "");
      formData.append("images", photo);
      if (departmentId) formData.append("department", departmentId);

      const record = await pb.collection("grievances").create(formData);

      setSuccessId(record.id);
      setTitle("");
      setDescription("");
      setCategory("");
      setPhoto(null);
      setPhotoConfirmed(false);
      setLatitude("");
      setLongitude("");
      setDepartmentId("");
    } catch (submitError: any) {
      setError(getPocketBaseErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setPhoto(null);
    setPhotoConfirmed(false);

    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;

    setPhotoValidating(true);
    try {
      const gpsData = await extractGpsFromPhoto(selectedFile);
      setPhotoValidating(false);

      if (gpsData.found) {
        // GPS data found - auto-populate coordinates
        setLatitude(gpsData.latitude!.toFixed(6));
        setLongitude(gpsData.longitude!.toFixed(6));
        setPhoto(selectedFile);
        console.log("✅ Photo accepted with auto-filled GPS coordinates");
      } else {
        // No GPS EXIF data found - still accept photo but require manual coordinates
        setPhoto(selectedFile);
        setError("⚠️ No GPS data in photo. Please enter location manually using the 'Use my GPS' button or type coordinates manually.");
        console.log("⚠️ Photo accepted without GPS data - user must enter coordinates manually");
      }
    } catch (validationError) {
      setPhotoValidating(false);
      event.target.value = "";
      console.error("Photo validation error:", validationError);
      setError("Error reading photo. Please try another photo.");
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="max-w-2xl mb-8 md:mb-10">
          <h1 className="font-display text-2xl md:text-3xl">Submit a Complaint</h1>
          <p className="mt-2 md:mt-3 text-sm md:text-base text-muted-foreground">
            Fill the details and upload a GPS-tagged photo as proof. Location will be auto-filled from the photo.
          </p>
        </div>

        <div className="mt-6 md:mt-8">
          <Card className="border-border shadow-[var(--shadow-soft)]">
            <CardContent className="p-5 md:p-7">
              <form onSubmit={onSubmit} className="space-y-5 md:space-y-6">
                {error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {successId ? (
                  <div className="flex items-start gap-3 rounded-md border border-green-500/30 bg-green-50 px-4 py-3 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="font-medium">Complaint submitted successfully.</div>
                      <div className="mt-1 opacity-80">Reference ID: {successId}</div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="title">Complaint title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Example: Large pothole near main road"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue clearly, what is happening, and how serious it is."
                    className="min-h-32"
                    required
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as typeof category)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                      required
                    >
                      <option value="" disabled>Select category</option>
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {categoryLabels[item]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department (optional)</Label>
                    <select
                      id="department"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                      disabled={departmentsLoading}
                    >
                      <option value="">
                        {departmentsLoading
                          ? "Loading departments…"
                          : departments.length === 0
                            ? "No departments available"
                            : "Select department (optional)"}
                      </option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {!departmentsLoading && departments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Admin will route your complaint to the right department.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Upload issue photo</Label>
                  <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Camera className="h-4 w-4" />
                      Upload a photo (GPS data will be extracted if available)
                    </div>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/jpeg,image/jpg"
                      capture="environment"
                      onChange={handlePhotoChange}
                      required
                    />
                    {photoValidating ? (
                      <p className="mt-2 text-sm text-muted-foreground">🔍 Reading photo data...</p>
                    ) : null}
                    {photo ? <p className="mt-2 text-sm text-green-600">✓ Photo selected</p> : null}
                  </div>

                  {photo ? (
                    <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                      <input
                        type="checkbox"
                        id="photoConfirm"
                        checked={photoConfirmed}
                        onChange={(e) => setPhotoConfirmed(e.target.checked)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="photoConfirm" className="flex-1 cursor-pointer text-sm text-yellow-900 dark:text-yellow-100">
                        ✓ I confirm this photo directly shows the issue described in my complaint
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <MapPinned className="h-4 w-4 text-primary" />
                        Location (Latitude / Longitude)
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter the coordinates of the issue, or tap "Use my GPS" to fill them automatically.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={getCurrentLocation} disabled={locationLoading}>
                      {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
                      {locationLoading ? "Fetching..." : "Use my GPS"}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="e.g. 17.385044"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="longitude" className="text-xs">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="e.g. 78.486671"
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={submitting || photoValidating || (photo !== null && !photoConfirmed)} className="w-full font-semibold">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Submitting complaint..." : "Submit Complaint"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
