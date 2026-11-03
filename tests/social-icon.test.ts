import { describe, expect, it } from "vitest";
import { socialBrand } from "@/components/ui/SocialIcon";

describe("footer social logos", () => {
  it("picks the logo from the link's address", () => {
    expect(socialBrand("https://www.instagram.com/jerrycomputers.jerin/")).toBe("instagram");
    expect(socialBrand("https://m.facebook.com/jerry")).toBe("facebook");
    expect(socialBrand("https://youtu.be/abc")).toBe("youtube");
    expect(socialBrand("https://twitter.com/jerry")).toBe("x");
    expect(socialBrand("https://www.linkedin.com/company/jerry")).toBe("linkedin");
    expect(socialBrand("https://wa.me/919791230446")).toBe("whatsapp");
  });

  it("falls back to the name, and to a plain globe for other sites", () => {
    expect(socialBrand("https://example.com/insta", "Instagram")).toBe("instagram");
    expect(socialBrand("https://notinstagram.com/x", "Our blog")).toBeNull();
  });
});
