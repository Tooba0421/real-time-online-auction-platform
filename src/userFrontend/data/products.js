import VintageWoodenChair from "../../assets/VintageWoodenChair.jpg";
import ModernLamp from "../../assets/ModernLamp.jpg";
import AntiqueVase from "../../assets/AntiqueVase.jpg";

import jewelry from "../../assets/jewelry.jpg";
import antiques from "../../assets/antiques.jpg";
import furniture from "../../assets/furniture.jpg";
import electronics from "../../assets/electronics.jpg";
import interiors from "../../assets/interiors.jpg";
import artwork from "../../assets/artwork.jpg";
import musicMoviesCameras from "../../assets/musicMoviesCameras.jpg";
import coinsStamps from "../../assets/coinsStamps.jpg";
import fashion from "../../assets/fashion.png";
import toysModels from "../../assets/toysModels.jpg";
import luxuryWatches from "../../assets/luxuryWatches.jpg";

export const products = [
  {
    id: 1,
    title: "Vintage Wooden Chair",
    seller: "Ahmed Furniture House",
    category: "Furniture",
    condition: "Used - Excellent",
    material: "Solid Oak Wood",
    dimension: "40 x 22 x 20 inches",
    weight: 18,
    description:
      "A handcrafted vintage wooden chair made from premium oak wood with elegant carvings and polished finish. Perfect for antique-style interiors and luxury living spaces.",
    base_price: 250000,
    reserved_price: 320000,
    currentBid: 298500,
    totalBids: 12,
    min_increment: 5000,
    image: VintageWoodenChair,
    product_images: [
      VintageWoodenChair,
      furniture,
      interiors
    ],
    endTime: "2026-06-10T18:00:00",
  },

  {
    id: 2,
    title: "Modern Decorative Lamp",
    seller: "Karachi Home Decor",
    category: "Interiors",
    condition: "Brand New",
    material: "Metal & Glass",
    dimension: "28 x 10 inches",
    weight: 5,
    description:
      "A stylish modern decorative floor lamp with warm LED lighting and luxury metallic finish ideal for bedrooms and lounges.",
    base_price: 40000,
    reserved_price: 60000,
    currentBid: 52000,
    totalBids: 8,
    min_increment: 2000,
    image: ModernLamp,
    product_images: [
      ModernLamp,
      interiors,
      furniture
    ],
    endTime: "2026-06-12T21:00:00",
  },

  {
    id: 3,
    title: "Antique Ceramic Vase",
    seller: "Classic Antiques",
    category: "Antiques",
    condition: "Antique",
    material: "Ceramic",
    dimension: "24 x 12 inches",
    weight: 7,
    description:
      "A rare antique ceramic vase featuring hand-painted floral artwork and preserved historical detailing.",
    base_price: 280000,
    reserved_price: 350000,
    currentBid: 335000,
    totalBids: 6,
    min_increment: 5000,
    image: AntiqueVase,
    product_images: [
      AntiqueVase,
      antiques,
      artwork
    ],
    endTime: "2026-06-14T16:30:00",
  },

  {
    id: 4,
    title: "Diamond Necklace Set",
    seller: "Royal Jewelers",
    category: "Jewelry",
    condition: "Brand New",
    material: "Gold & Diamond",
    dimension: "Custom Fit",
    weight: 1,
    description:
      "Luxury diamond necklace set crafted with premium gold finishing and certified diamonds.",
    base_price: 300000,
    reserved_price: 420000,
    currentBid: 360000,
    totalBids: 10,
    min_increment: 10000,
    image: jewelry,
    product_images: [
      jewelry,
      fashion,
      luxuryWatches
    ],
    endTime: "2026-06-16T20:00:00",
  },

  {
    id: 5,
    title: "Designer Summer Outfit",
    seller: "Fashion Hub",
    category: "Fashion",
    condition: "Brand New",
    material: "Premium Cotton",
    dimension: "Medium Size",
    weight: 1,
    description:
      "Premium designer summer outfit with modern stitching and elegant casual style.",
    base_price: 50000,
    reserved_price: 70000,
    currentBid: 62000,
    totalBids: 15,
    min_increment: 2000,
    image: fashion,
    product_images: [
      fashion,
      jewelry,
      interiors
    ],
    endTime: "2026-06-18T22:00:00",
  },

  {
    id: 6,
    title: "Vintage Camera Collection",
    seller: "Media Market",
    category: "Music,Movies & Cameras",
    condition: "Used - Good",
    material: "Metal",
    dimension: "Collection Set",
    weight: 8,
    description:
      "A collection of vintage cameras for photography enthusiasts and antique collectors.",
    base_price: 45000,
    reserved_price: 65000,
    currentBid: 54000,
    totalBids: 9,
    min_increment: 3000,
    image: musicMoviesCameras,
    product_images: [
      musicMoviesCameras,
      electronics,
      artwork
    ],
    endTime: "2026-06-20T19:00:00",
  },

  {
    id: 7,
    title: "Abstract Wall Painting",
    seller: "Art Gallery Karachi",
    category: "Artwork",
    condition: "Brand New",
    material: "Canvas",
    dimension: "48 x 36 inches",
    weight: 4,
    description:
      "Modern abstract wall painting with vibrant colors and handmade brush detailing.",
    base_price: 30000,
    reserved_price: 50000,
    currentBid: 41000,
    totalBids: 7,
    min_increment: 2000,
    image: artwork,
    product_images: [
      artwork,
      interiors,
      antiques
    ],
    endTime: "2026-06-22T18:30:00",
  },

  {
    id: 8,
    title: "Rare Coin Collector Set",
    seller: "Collectors Corner",
    category: "Coins & Stamps",
    condition: "Collectible",
    material: "Mixed Metal",
    dimension: "Collector Album",
    weight: 2,
    description:
      "Rare historic coin collection featuring limited edition collectible coins.",
    base_price: 25000,
    reserved_price: 40000,
    currentBid: 33000,
    totalBids: 5,
    min_increment: 1000,
    image: coinsStamps,
    product_images: [
      coinsStamps,
      antiques,
      artwork
    ],
    endTime: "2026-06-24T14:00:00",
  },

  {
    id: 9,
    title: "Luxury Gold Bracelet",
    seller: "Elite Jewelers",
    category: "Jewelry",
    condition: "Brand New",
    material: "24K Gold",
    dimension: "Adjustable",
    weight: 1,
    description:
      "Elegant luxury gold bracelet crafted with premium finishing and timeless design.",
    base_price: 380000,
    reserved_price: 500000,
    currentBid: 450000,
    totalBids: 11,
    min_increment: 10000,
    image: jewelry,
    product_images: [
      jewelry,
      luxuryWatches,
      fashion
    ],
    endTime: "2026-06-26T17:00:00",
  },

  {
    id: 10,
    title: "Antique Royal Vase",
    seller: "Vintage Collections",
    category: "Antiques",
    condition: "Antique",
    material: "Porcelain",
    dimension: "30 x 14 inches",
    weight: 10,
    description:
      "Royal antique vase featuring traditional artwork and museum-inspired design.",
    base_price: 220000,
    reserved_price: 300000,
    currentBid: 275000,
    totalBids: 6,
    min_increment: 5000,
    image: AntiqueVase,
    product_images: [
      AntiqueVase,
      antiques,
      interiors
    ],
    endTime: "2026-06-28T15:00:00",
  },

  {
    id: 11,
    title: "Classic Wooden Dining Chair",
    seller: "Modern Furniture Co.",
    category: "Furniture",
    condition: "Used - Excellent",
    material: "Walnut Wood",
    dimension: "42 x 20 inches",
    weight: 15,
    description:
      "Classic dining chair with polished walnut finish and premium craftsmanship.",
    base_price: 150000,
    reserved_price: 200000,
    currentBid: 185000,
    totalBids: 4,
    min_increment: 3000,
    image: VintageWoodenChair,
    product_images: [
      VintageWoodenChair,
      furniture,
      interiors
    ],
    endTime: "2026-06-30T20:30:00",
  },

  {
    id: 12,
    title: "LED Interior Floor Lamp",
    seller: "Home Style Store",
    category: "Interiors",
    condition: "Brand New",
    material: "Steel & Glass",
    dimension: "60 inches",
    weight: 6,
    description:
      "Luxury LED floor lamp designed for premium home interiors and modern decor.",
    base_price: 35000,
    reserved_price: 50000,
    currentBid: 42000,
    totalBids: 9,
    min_increment: 2000,
    image: ModernLamp,
    product_images: [
      ModernLamp,
      interiors,
      furniture
    ],
    endTime: "2026-07-02T13:00:00",
  },

  {
    id: 13,
    title: "Retro Film Camera",
    seller: "Camera World",
    category: "Music,Movies & Cameras",
    condition: "Used - Good",
    material: "Metal",
    dimension: "Compact",
    weight: 2,
    description:
      "Classic retro film camera perfect for collectors and photography lovers.",
    base_price: 50000,
    reserved_price: 80000,
    currentBid: 68000,
    totalBids: 13,
    min_increment: 3000,
    image: musicMoviesCameras,
    product_images: [
      musicMoviesCameras,
      electronics,
      artwork
    ],
    endTime: "2026-07-04T18:00:00",
  },

  {
    id: 14,
    title: "Handmade Abstract Canvas",
    seller: "Creative Arts Studio",
    category: "Artwork",
    condition: "Brand New",
    material: "Canvas",
    dimension: "50 x 40 inches",
    weight: 5,
    description:
      "Handmade abstract canvas painting featuring modern artistic expression.",
    base_price: 60000,
    reserved_price: 85000,
    currentBid: 72000,
    totalBids: 8,
    min_increment: 3000,
    image: artwork,
    product_images: [
      artwork,
      interiors,
      antiques
    ],
    endTime: "2026-07-06T21:00:00",
  },

  {
    id: 15,
    title: "Historic Stamp Collection",
    seller: "Heritage Collectibles",
    category: "Coins & Stamps",
    condition: "Collectible",
    material: "Paper Collection",
    dimension: "Collector Album",
    weight: 1,
    description:
      "Historic international stamp collection preserved in premium condition.",
    base_price: 30000,
    reserved_price: 45000,
    currentBid: 39000,
    totalBids: 6,
    min_increment: 1000,
    image: coinsStamps,
    product_images: [
      coinsStamps,
      antiques,
      artwork
    ],
    endTime: "2026-07-08T16:00:00",
  },

  {
    id: 16,
    title: "Premium Designer Jacket",
    seller: "Urban Fashion",
    category: "Fashion",
    condition: "Brand New",
    material: "Leather",
    dimension: "Large Size",
    weight: 2,
    description:
      "Premium designer leather jacket with modern luxury styling.",
    base_price: 45000,
    reserved_price: 65000,
    currentBid: 55000,
    totalBids: 10,
    min_increment: 2000,
    image: fashion,
    product_images: [
      fashion,
      jewelry,
      luxuryWatches
    ],
    endTime: "2026-07-10T20:00:00",
  },

  {
    id: 17,
    title: "Limited Edition Racing Car Model",
    seller: "Urban Fashion",
    category: "Toys & Models",
    condition: "Brand New",
    material: "Die Cast Metal",
    dimension: "18 inches",
    weight: 3,
    description:
      "Limited edition racing car collectible model with premium detailing.",
    base_price: 40000,
    reserved_price: 60000,
    currentBid: 55000,
    totalBids: 10,
    min_increment: 2000,
    image: toysModels,
    product_images: [
      toysModels,
      artwork,
      electronics
    ],
    endTime: "2026-07-12T15:00:00",
  },

  {
    id: 18,
    title: "Swiss Luxury Watch",
    seller: "Luxury Timepieces",
    category: "Luxury Watches",
    condition: "Brand New",
    material: "Stainless Steel",
    dimension: "42mm Dial",
    weight: 1,
    description:
      "Premium Swiss luxury watch with sapphire crystal and automatic movement.",
    base_price: 50000,
    reserved_price: 75000,
    currentBid: 55000,
    totalBids: 10,
    min_increment: 3000,
    image: luxuryWatches,
    product_images: [
      luxuryWatches,
      jewelry,
      fashion
    ],
    endTime: "2026-07-14T18:30:00",
  },

  {
    id: 19,
    title: "Gaming Console Bundle",
    seller: "Electro Hub",
    category: "Electronics",
    condition: "Like New",
    material: "Electronic Components",
    dimension: "Standard Console Size",
    weight: 4,
    description:
      "Complete gaming console bundle including controllers and premium accessories.",
    base_price: 45000,
    reserved_price: 65000,
    currentBid: 55000,
    totalBids: 10,
    min_increment: 3000,
    image: electronics,
    product_images: [
      electronics,
      musicMoviesCameras,
      toysModels
    ],
    endTime: "2026-07-16T22:00:00",
  },

  {
    id: 20,
    title: "Diamond Luxury Wrist Watch",
    seller: "Royal Time Gallery",
    category: "Luxury Watches",
    condition: "Brand New",
    material: "Diamond & Gold",
    dimension: "40mm Dial",
    weight: 1,
    description:
      "Luxury wrist watch with diamond detailing and premium gold finishing.",
    base_price: 50000,
    reserved_price: 80000,
    currentBid: 55000,
    totalBids: 10,
    min_increment: 3000,
    image: luxuryWatches,
    product_images: [
      luxuryWatches,
      jewelry,
      fashion
    ],
    endTime: "2026-07-18T19:30:00",
  },
];