export const generateEmbedding = async (text, inputType = "document") => {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-4-lite",
      input: [text],
      input_type: inputType,
      output_dimension: 512,
    }),
  });

  const data = await response.json();

  return Array.from(data.data[0].embedding);
};
