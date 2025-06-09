import { Toaster as Sonner } from "sonner";

const Toaster = () => {
  return (
    <Sonner
      position="bottom-right"
      richColors
      expand={false}
      visibleToasts={5}
      toastOptions={{
        style: {
          background: "white",
          border: "1px solid #e5e7eb",
          color: "#374151",
        },
        className: "my-toast",
        duration: 4000,
      }}
    />
  );
};

export { Toaster };
