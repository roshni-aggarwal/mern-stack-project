"use client";

import { useRouter } from "next/navigation";
import {useQueryParams} from '../hooks/useQueryParams'

function PaginationSection({
  lastPage,
  pageNo,
  pageSize
}: {
  lastPage: number;
  pageNo: number;
    pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useQueryParams()

  function handlePageChange(newPage: number) {
    searchParams.set('page', String(newPage));
    router.push(`/products?${searchParams.toString()}`);
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSize = parseInt(e.target.value);
    searchParams.delete('page');
    searchParams.set('pageSize', String(newSize));
    router.push(`/products?${searchParams.toString()}`);
  }

  return (
    <div className="mt-12 p-4 bg-gray-800 flex justify-center gap-4 items-center mb-8">
      <select
        value={pageSize}
        name="page-size"
        className="text-black"
        onChange={handlePageSizeChange}
      >
        {["10", "25", "50"].map((val) => {
          return (
            <option key={val} value={val}>
              {val}
            </option>
          );
        })}
      </select>
      <button
        className="p-3 bg-slate-300 text-black disabled:cursor-not-allowed"
        disabled={pageNo === 1}
        onClick={() => handlePageChange(pageNo - 1)}
      >
        &larr;Prev
      </button>
      <p>
        Page {pageNo} of {lastPage}{" "}
      </p>
      <button
        className="p-3 bg-slate-300 text-black disabled:cursor-not-allowed"
        disabled={pageNo === lastPage}
        onClick={() => handlePageChange(pageNo + 1)}
      >
        Next&rarr;
      </button>
    </div>
  );
}

export default PaginationSection;
